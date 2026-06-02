import json, math, os
from flamapy.interfaces.python import FLAMAFeatureModel
from flamapy.core.exceptions import FlamaException
from antlr4 import CommonTokenStream, FileStream
from uvl.UVLCustomLexer import UVLCustomLexer
from uvl.UVLPythonParser import UVLPythonParser
from antlr4.error.ErrorListener import ErrorListener
from flamapy.core.discover import DiscoverMetamodels
from flamapy.metamodels.fm_metamodel.transformations import GlencoeReader, AFMReader, FeatureIDEReader, JSONReader, XMLReader, UVLReader, GlencoeWriter
from flamapy.metamodels.configuration_metamodel.models import Configuration
from flamapy.metamodels.configurator_metamodel.transformation import FmToConfigurator
from collections import defaultdict
from flamapy.metamodels.fm_metamodel.operations import FMLanguageLevel
from flamapy.metamodels.fm_metamodel.models import AttributeType

try:
    from flamapy.metamodels.z3_metamodel.transformations import FmToZ3
    from flamapy.metamodels.z3_metamodel.operations import Z3AttributeOptimization
    from flamapy.metamodels.z3_metamodel.operations.interfaces import OptimizationGoal
    _z3_available = True
except ImportError:
    _z3_available = False


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
            print(warning_message)
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

        return json.dumps({'valid': True, 'modelInformation': get_model_information()})
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


def get_language_level(fm: FLAMAFeatureModel):
    levels = FMLanguageLevel().execute(fm.fm_model).get_result()
    major_level = levels.major.name.capitalize()
    minors_levels = ', '.join([m.name.replace('_', ' ').capitalize() for m in levels.minors])
    minors_suffix = " ({})".format(minors_levels) if minors_levels else ""
    return "{}{}".format(major_level, minors_suffix)


def execute_pysat_operation(name: str):
    dm = DiscoverMetamodels()
    feature_model = fm.fm_model
    if 'BDD' in name:
        bdd_model = dm.use_transformation_m2m(feature_model, 'bdd')
        operation = dm.get_operation(bdd_model, name)
        operation.execute(bdd_model)

    elif 'PySAT' in name:
        if name in ['PySATConflictDetection', 'PySATDiagnosis']:
            sat_model = dm.use_transformation_m2m(feature_model, "pysat_diagnosis")
        else:
            sat_model = dm.use_transformation_m2m(feature_model, "pysat")
        # Get the operation
        operation = dm.get_operation(sat_model, name)
        # Execute the operation
        operation.execute(sat_model)
    
    elif 'Z3' in name:
        if not _z3_available:
            return json.dumps("Z3 plugin is not installed.")
        print(f"Executing Z3 operation {name}")
        z3_model = dm.use_transformation_m2m(feature_model, "z3")
        # Get the operation
        operation = dm.get_operation(z3_model, name)
        # Execute the operation
        operation.execute(z3_model)
        
    # Get and print the result
    result = operation.get_result()
    if type(result) is list:
        return json.dumps([str(conf) for conf in result])
    if isinstance(result, (defaultdict, dict)):
        return json.dumps(["{}: {}".format(str(k), str(v)) for k,v in result.items()])
    return json.dumps(result)

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
        attributes = list(attributes)
        print("Numerical attributes:", attributes)
        return attributes

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
    print(f"Generating feature flow map for attribute: {attribute_name}")
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
    root = fm.fm_model.root
    result = build_node(root)
    print("Feature Flow Map result:", result)
    return result

def execute_configurator_operation(name: str, conf):
    dm = DiscoverMetamodels()
    feature_model = fm.fm_model
    configuration = Configuration(conf)
    if 'BDD' in name:
        bdd_model = dm.use_transformation_m2m(feature_model, 'bdd')
        operation = dm.get_operation(bdd_model, name)
        operation.set_configuration(configuration)
        operation.execute(bdd_model)

    elif 'PySAT' in name:
        if name in ['PySATConflictDetection', 'PySATDiagnosis']:
            sat_model = dm.use_transformation_m2m(feature_model, "pysat_diagnosis")
        else:
            sat_model = dm.use_transformation_m2m(feature_model, "pysat")
        # Get the operation
        operation = dm.get_operation(sat_model, name)
        operation.set_configuration(configuration)
        # Execute the operation
        operation.execute(sat_model)
    # Get and print the result
    result = operation.get_result()
    if type(result) is list:
        return [str(conf) for conf in result]
    return result

def execute_attribute_optimization(attributes_goals):
    if not _z3_available:
        return ["Z3 plugin is not installed."]
    print("Attributes goals received:", attributes_goals)

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
