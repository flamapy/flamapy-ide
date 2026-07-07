import json, math, os
from flamapy.interfaces.python import FLAMAFeatureModel
from antlr4 import CommonTokenStream, FileStream
from uvl.UVLCustomLexer import UVLCustomLexer
from uvl.UVLPythonParser import UVLPythonParser
from antlr4.error.ErrorListener import ErrorListener
from flamapy.core.discover import DiscoverMetamodels
from flamapy.metamodels.fm_metamodel.transformations import GlencoeReader, AFMReader, FeatureIDEReader, JSONReader, XMLReader, UVLReader, GlencoeWriter
from flamapy.metamodels.configurator_metamodel.transformation import FmToConfigurator
from flamapy.metamodels.fm_metamodel.operations import FMLanguageLevel
from flamapy.metamodels.fm_metamodel.models import AttributeType

try:
    from flamapy.metamodels.z3_metamodel.transformations import FmToZ3
    from flamapy.metamodels.z3_metamodel.operations import Z3AttributeOptimization
    from flamapy.metamodels.z3_metamodel.operations.interfaces import OptimizationGoal
    _z3_available = True
except ImportError:
    _z3_available = False

# SAT MaxSAT optimization is a newer flamapy-sat operation; guard the import so the IDE
# keeps working against flamapy-sat releases that predate it.
try:
    from flamapy.metamodels.pysat_metamodel.transformations import FmToPysat
    from flamapy.metamodels.pysat_metamodel.operations import PySATAttributeOptimization
    from flamapy.core.operations import OptimizationGoal as _CoreOptimizationGoal
    _sat_optimization_available = True
except ImportError:
    _sat_optimization_available = False


fm = None
configurator = None

  
# Custom error listener
class CustomErrorListener(ErrorListener):
    def __init__(self):
        self.errors = []
        self.warnings = []

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        if "namespaces" in msg:
            warning_message = (
                f"The UVL has the following warning that prevents reading it: "
                f"Line {line}:{column} - {msg}"
            )
            self.warnings.append(warning_message)
        else:
            error_message = (
                f"The UVL has the following error that prevents reading it: "
                f"Line {line}:{column} - {msg}"
            )
            self.errors.append(error_message)
def find_duplicates(items):
	seen = set()
	duplicates = set()
	for item in items:
		if item in seen:
			duplicates.add(item)
		else:
			seen.add(item)
	return list(duplicates)
# Function to process UVL file
def process_uvl_file(file_path):
    try:
        input_stream = FileStream(file_path)
        lexer = UVLCustomLexer(input_stream)

        error_listener = CustomErrorListener()

        lexer.removeErrorListeners()
        lexer.addErrorListener(error_listener)

        stream = CommonTokenStream(lexer)
        parser = UVLPythonParser(stream)

        parser.removeErrorListeners()
        parser.addErrorListener(error_listener)
        
        parser.featureModel()
        if error_listener.errors or error_listener.warnings:
            return json.dumps({'valid': False, 'errors': error_listener.errors, 'warnings': error_listener.warnings})
        global fm
        fm = FLAMAFeatureModel(file_path)
        duplicated_features = find_duplicates(fm.fm_model.get_features())
        if duplicated_features:
            errors = []
            for duplicated in duplicated_features:
                errors.append('The following feature is duplicated: {}'.format(duplicated))
            return json.dumps({'valid': False, 'errors': errors})

        # Model metrics are NOT computed here: validation runs on (debounced)
        # keystrokes and some metrics (core features, atomic sets) are full
        # analyses. The IDE requests them separately via get_model_information_json.
        return json.dumps({'valid': True})
    except Exception as e:
        error_message = str(e)
        return json.dumps({'valid': False, 'errors': [error_message]})

        
def get_model_information():
    model_information = dict()

    model_information['Language Level'] = get_language_level(fm)
    model_information['Average Branching Factor'] = fm.average_branching_factor()
    model_information['Leaf Number'] = fm.count_leafs()
    model_information['Estimated Number of Configurations'] = fm.estimated_number_of_configurations()
    model_information['Max Depth'] = fm.max_depth()
    model_information['Atomic Sets'] = fm.atomic_sets()
    model_information['Core Features'] = fm.core_features()
    model_information['Leaf Features'] = fm.leaf_features()
    return model_information


def get_model_information_json():
    return json.dumps(get_model_information())


def get_language_level(fm: FLAMAFeatureModel):
    levels = FMLanguageLevel().execute(fm.fm_model).get_result()
    major_level = levels.major.name.capitalize()
    minors_levels = ', '.join([m.name.replace('_', ' ').capitalize() for m in levels.minors])
    minors_suffix = " ({})".format(minors_levels) if minors_levels else ""
    return "{}{}".format(major_level, minors_suffix)


# ---------------------------------------------------------------------------
# Plugin capability catalog + runtime plugin installation
#
# The IDE builds its solver tabs and operations menus from the *installed*
# flamapy plugins instead of a hardcoded table, so a plugin installed at runtime
# (see install_plugin) surfaces its solver and operations with no IDE code change.
# All derivation happens here, against the shipped flamapy wheels — the framework
# itself is untouched.
# ---------------------------------------------------------------------------

# Backend token (what the facade's ``backend=`` kwarg and the UI tabs use) derived
# from a plugin's model extension. Only ``pysat`` differs from its token ("sat");
# the facade encodes the same one-off as ``_BACKEND_ALIAS = {"sat": "pysat"}``.
_EXTENSION_TO_BACKEND = {"pysat": "sat"}

# Extensions that are not selectable analysis backends: the base feature model
# (structural operations run on it directly) and configuration models (their
# operations need a configuration input and are driven from the config panel).
_NON_BACKEND_EXTENSIONS = {"fm", "configuration", "configurator"}


def _humanize_operation(name: str) -> str:
    """A readable default label for an operation whose method name is snake_case."""
    return name.replace('_', ' ').capitalize()


def _input_kind(inp) -> str:
    """Map a framework Input to a UI input kind: 'integer', 'feature', or 'scalar'.

    The framework does not tag an input as "a feature name", so it is inferred from
    the type (int -> integer) and a name convention; the IDE only needs this to pick
    a number field vs a feature picker, and unknown inputs fall back to a text field.
    """
    if inp.type is int:
        return "integer"
    if inp.name.endswith("_name") or inp.name in ("feature", "variable"):
        return "feature"
    return "scalar"


def _catalog_from_discovery(dm: DiscoverMetamodels) -> dict:
    """Build the plugin/operation catalog from a discovery instance.

    Returns ``{plugins: [...], operations: [...]}`` where each operation carries the
    backend tokens that implement it (derived, since the descriptor's ``backends``
    field is not populated in flamapy 2.6). Only analysis operations ('operation'
    kind, no configuration input) are included; producers, transformers and
    configuration-driven operations are surfaced through their own dedicated UI.
    """
    plugins: dict[str, dict] = {}   # backend token -> {name, extension}
    operations = []

    def plugin_backend(plugin):
        try:
            extension = plugin.get_extension()
        except Exception:
            return None
        if not extension or extension in _NON_BACKEND_EXTENSIONS:
            return None
        return _EXTENSION_TO_BACKEND.get(extension, extension), extension

    for name, descriptor in dm.available_operations().items():
        if descriptor.kind != 'operation':
            continue
        if any(inp.kind == 'configuration' for inp in descriptor.inputs):
            continue

        backends = []
        for plugin in dm.get_plugins_with_operation(descriptor.operation):
            resolved = plugin_backend(plugin)
            if resolved is None:
                continue
            token, extension = resolved
            backends.append(token)
            plugins.setdefault(token, {"name": plugin.name, "extension": extension})

        backends = sorted(set(backends))
        operations.append({
            "method": name,
            "operation": descriptor.operation,
            "label": _humanize_operation(name),
            "structural": len(backends) == 0,
            "backends": backends,
            "selectableBackend": bool(descriptor.selectable_backend),
            "inputs": [
                {
                    "name": inp.name,
                    "kind": _input_kind(inp),
                    "required": bool(inp.required),
                }
                for inp in descriptor.inputs
            ],
        })

    catalog_plugins = [
        {"backend": token, "name": info["name"], "extension": info["extension"]}
        for token, info in sorted(plugins.items())
    ]
    return {"plugins": catalog_plugins, "operations": operations}


def get_plugin_catalog():
    """JSON capability catalog of the installed plugins, for the IDE to build its UI."""
    return json.dumps(_catalog_from_discovery(DiscoverMetamodels()))


def refresh_plugins():
    """Re-scan installed plugins and re-init the facade so new operations are callable.

    The actual ``micropip.install`` of a plugin wheel happens on the JS side (see
    flamapy.js), where the async loader lives. This performs the Python-side
    re-initialisation the frozen facade needs afterwards, and returns the refreshed
    catalog so the worker can hand the UI the new surface.
    """
    import importlib
    from flamapy.interfaces.python import flamapy_feature_model as _ffm

    importlib.invalidate_caches()
    # Rebuild the module-level discovery the facade + producers share, then re-run the
    # installer so the new operations are added as methods on the FLAMAFeatureModel
    # class. Methods live on the class, so the existing ``fm`` instance sees them and
    # its loaded model is preserved.
    _ffm._DISCOVERY = DiscoverMetamodels()
    _ffm._install_operations(_ffm.FLAMAFeatureModel)
    # The loaded instance carries its own discovery (built at construction, before the
    # new plugin existed); re-scan it too so new backends/transformations resolve, and
    # drop its cached fm->backend models so they rebuild against the new plugin set.
    if fm is not None:
        fm.discover_metamodel.reload()
        fm._backend_models = {}
    return get_plugin_catalog()


def _facade_display_item(item):
    """Render a single result item as a readable one-line string."""
    if isinstance(item, dict):
        return ", ".join("{}: {}".format(k, v) for k, v in item.items())
    if isinstance(item, (list, tuple, set)):
        return ", ".join(str(i) for i in item)
    return str(item)


def _serialize_facade_result(result):
    """JSON-serialize any facade result for display in the IDE output panel.

    The facade returns ``None`` when an operation cannot be computed (missing
    plugin or unsupported model); that is surfaced as a readable message.
    """
    if result is None:
        return json.dumps(
            "The operation could not be computed. The required plugin may be "
            "unavailable or the operation may not be supported for this model."
        )
    if isinstance(result, bool) or isinstance(result, (int, float, str)):
        return json.dumps(result)
    if isinstance(result, dict):
        return json.dumps(
            ["{}: {}".format(k, _facade_display_item(v)) for k, v in result.items()]
        )
    if isinstance(result, (list, tuple, set)):
        return json.dumps([_facade_display_item(i) for i in result])
    return json.dumps(str(result))


def execute_facade_operation(name: str, args_json: str = "{}"):
    """Run any FLAMAFeatureModel facade method by name and JSON-serialize its result.

    ``args_json`` is a JSON object whose keys are forwarded as keyword arguments
    (e.g. {"backend": "sat"}). The facade hides backend selection and result
    post-processing, so this single dispatcher replaces the per-backend routing.
    """
    args = json.loads(args_json) if args_json else {}
    method = getattr(fm, name, None)
    if not callable(method):
        return json.dumps("Unknown operation '{}'.".format(name))
    return _serialize_facade_result(method(**args))


def execute_facade_operation_with_config(
    name: str, configs_json: str = "{}", args_json: str = "{}"
):
    """Run a facade method that needs one or more configuration inputs.

    ``configs_json`` maps each configuration keyword argument (e.g. "configuration_path",
    "test_case_path") to a {feature: value} mapping, passed straight to the facade — which
    accepts a mapping, a Configuration, or a path. ``args_json`` carries the remaining
    scalar kwargs (e.g. backend, full_configuration, max_diagnoses).
    """
    args = json.loads(args_json) if args_json else {}
    configs = json.loads(configs_json) if configs_json else {}
    method = getattr(fm, name, None)
    if not callable(method):
        return json.dumps("Unknown operation '{}'.".format(name))
    args.update(configs)
    return _serialize_facade_result(method(**args))


def execute_export_transformation(transformation: str):
    dm = DiscoverMetamodels()
    feature_model = fm.fm_model
    if transformation == 'gfm.json':
        result = GlencoeWriter('exported_model.{}'.format(transformation), fm.fm_model).transform()
    else:
        result = dm.use_transformation_m2t(feature_model,'exported_model.{}'.format(transformation))
    os.remove('exported_model.{}'.format(transformation))
    return result

def execute_import_transformation(file_extension: str, file_content: str):
    with open("import.{}".format(file_extension), "w") as text_file:
        text_file.write(file_content)
    dm = DiscoverMetamodels()
    feature_model = False
    match(file_extension):
        case 'gfm.json':
            feature_model = GlencoeReader("import.gfm.json").transform()
            os.remove("import.gfm.json")
        case 'afm':
            feature_model = AFMReader("import.afm").transform()
            os.remove("import.afm")
        case 'fide':
            feature_model = FeatureIDEReader("import.fide").transform()
            os.remove("import.fide")
        case 'json':
            feature_model = JSONReader("import.json").transform()
            os.remove("import.json")
        case 'xml':
            feature_model = XMLReader("import.xml").transform()
            os.remove("import.xml")
        case 'uvl':
            feature_model = UVLReader("import.uvl").transform()
            os.remove("import.uvl")
    
    if(feature_model):
        result = dm.use_transformation_m2t(feature_model,'import.uvl')
        os.remove("import.uvl")
        return result
    else:
        raise Exception("not_supported")

def feature_tree(node):
    res = dict()
    res['name'] = node.name
    res['attributes'] = dict()
    res['attributes']['isMandatory'] = node.is_mandatory()
    res['attributes']['isOptional'] = node.is_optional()
    res['attributes']['isAbstract'] = node.is_abstract
    res['attributes']['isMultifeature'] = node.is_multifeature()
    res['attributes']['featureCardinality'] = dict()
    res['attributes']['featureCardinality']['min'] = node.feature_cardinality.min
    res['attributes']['featureCardinality']['max'] = node.feature_cardinality.max
    res['attributes']['isNumerical'] = node.is_numerical()
    res['attributes']['isString'] = node.is_string()
    res['attributes']['featureType'] = node.feature_type.value
    res['attributes']['attributes'] = [str(attribute) for attribute in node.get_attributes()]

    if node.get_children():
        res['attributes']['isAlternativeGroup'] = node.is_alternative_group()
        res['attributes']['isOrGroup'] = node.is_or_group()
        res['attributes']['isCardinalityGroup'] = node.is_cardinality_group()
        if node.is_cardinality_group():
            res['attributes']['cardinalityGroup'] = dict()
            cardinalityGroup = [relation for relation in node.get_relations() if relation.is_cardinal()]
            res['attributes']['cardinalityGroup']['min'] = cardinalityGroup[0].card_min if cardinalityGroup else None
            res['attributes']['cardinalityGroup']['max'] = cardinalityGroup[0].card_max if cardinalityGroup else None
        res['children'] = [feature_tree(child) for child in node.get_children()]
    return res

def get_features():
    if fm:
        features = [feature.name for feature in fm.fm_model.get_features()]
        return features

def get_numerical_attributes():
    if fm:
        attributes = {attr.name for attr in fm.fm_model.get_attributes() if attr.attribute_type in [AttributeType.INTEGER, AttributeType.REAL]}
        return list(attributes)

def get_configuration_distribution():
    dm = DiscoverMetamodels()
    bdd_model = dm.use_transformation_m2m(fm.fm_model, 'bdd')
    operation = dm.get_operation(bdd_model, 'BDDProductDistribution')
    operation.execute(bdd_model)
    configdist = operation.product_distribution()
    descriptive_stats = operation.descriptive_statistics()
    dist_stats = {e: round(v, 2) for e, v in descriptive_stats.items()}
    return {'x': list(range(len(configdist))), 'y': configdist, 'descriptive_statistics': dist_stats}

def get_feature_inclusion_probabilities():
    dm = DiscoverMetamodels()
    bdd_model = dm.use_transformation_m2m(fm.fm_model, 'bdd')
    operation = dm.get_operation(bdd_model, 'BDDFeatureInclusionProbability')
    operation.execute(bdd_model)
    prob = operation.get_result()
    n_features = len(prob)
    x_axis = [x / 100.0 for x in range(0, 101, 1)]
    y_axis = [round(sum(math.isclose(x, round(p, 2), abs_tol=1e-4) for p in prob.values()) / n_features, 2) * 100 for x in x_axis]
    colors = ['rgb(231, 74, 59)'] + ['rgb(126, 157, 188)'] * (len(x_axis) - 2) + ['rgb(28, 200, 138)']
    colors[50] = 'rgb(246, 194, 62)'
    return {'x': x_axis, 'y': y_axis, 'colors': colors}

def get_feature_flow_map(attribute_name: str):
    def get_feature_value(feature):
        attrs = feature.get_attributes()
        if not attrs:
            return None
        for attr in attrs:
            if attr.name == attribute_name:
                return attr.default_value
        return None

    def build_node(feature):
        node = {
            "name": feature.name,
            "value": get_feature_value(feature)
        }
        children = feature.get_children()
        if children:
            node["children"] = [build_node(child) for child in children]
        return node
    return build_node(fm.fm_model.root)

def execute_attribute_optimization(attributes_goals, backend='z3'):
    if backend == 'sat':
        return _execute_attribute_optimization_sat(attributes_goals)

    if not _z3_available:
        return json.dumps({'results_str': ["Z3 plugin is not installed."], 'objectives': [], 'solutions': []})

    feature_model = fm.fm_model
    z3_model = FmToZ3(feature_model).transform()

    attribute_optimization_op = Z3AttributeOptimization()
    attributes = dict()
    for attr_goal_dict in attributes_goals:
        attr_name = attr_goal_dict['attribute']
        goal_str = attr_goal_dict['goal']
        attributes[attr_name] = OptimizationGoal.MINIMIZE if goal_str == 'Minimize' else OptimizationGoal.MAXIMIZE
    attribute_optimization_op.set_attributes(attributes)

    configurations_with_values = attribute_optimization_op.execute(z3_model).get_result()
    results_str = []
    results = {'objectives': list(attributes.keys()), 
               'solutions': []}
    for i, config_value in enumerate(configurations_with_values, 1):
        config, values = config_value
        config_str = ', '.join(f'{f}={v}' if not isinstance(v, bool) else f'{f}' for f,v in config.elements.items() if config.is_selected(f))
        values_str = ', '.join(f'{k}={v}' for k,v in values.items())
        results_str.append(f'Config. {i}: {config_str} | {values_str}')
        attr_values = [values[attr] for attr in attributes.keys()]
        results['solutions'].append({'name': f'Config. {i}', 'configuration': config_str, 'values': attr_values})
    results['results_str'] = results_str
    return json.dumps(results)

def _execute_attribute_optimization_sat(attributes_goals):
    if not _sat_optimization_available:
        return json.dumps({'objectives': [], 'solutions': [],
                           'results_str': ["SAT attribute optimization is not available in this build."]})
    if len(attributes_goals) != 1:
        return json.dumps({'objectives': [], 'solutions': [],
                           'results_str': ["The SAT backend optimizes a single attribute. Select exactly "
                                           "one, or use z3 for multi-objective optimization."]})

    attr_name = attributes_goals[0]['attribute']
    goal_str = attributes_goals[0]['goal']
    goal = _CoreOptimizationGoal.MINIMIZE if goal_str == 'Minimize' else _CoreOptimizationGoal.MAXIMIZE

    sat_model = FmToPysat(fm.fm_model).transform()
    op = PySATAttributeOptimization()
    op.set_attributes({attr_name: goal})
    configurations = op.execute(sat_model).get_result()
    optimum = op.get_optimum().get(attr_name)

    results_str = []
    results = {'objectives': [attr_name], 'solutions': []}
    for i, config in enumerate(configurations, 1):
        config_str = ', '.join(f'{f}' for f in config.elements if config.is_selected(f))
        results_str.append(f'Config. {i}: {config_str} | {attr_name}={optimum}')
        results['solutions'].append({'name': f'Config. {i}', 'configuration': config_str,
                                     'values': [optimum]})
    results['results_str'] = results_str
    return json.dumps(results)

def start_configurator():
    global configurator
    configurator = FmToConfigurator(fm.fm_model).transform()
    configurator.start()
    
    result = configurator.get_current_status()
    return json.dumps(result)

def answer_question(answer):
    valid = configurator.answer_question(answer)

    result = dict()
    result['valid'] = valid
    if valid:
        if configurator.next_question():
            result['nextQuestion'] = configurator.get_current_status()
        else:
            result['configuration'] = configurator._get_configuration()
    else:
        result['contradiction'] = {'msg': 'The selected choice is incompatible with the model definition. Please choose another option.'}
    
    result['history'] = configurator._get_configuration()
    return json.dumps(result)

def undo_answer():
    configurator.previous_question()

    result = configurator.get_current_status()
    result['history'] = configurator._get_configuration()

    return json.dumps(result)
