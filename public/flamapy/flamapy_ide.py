import json, os
from flamapy.interfaces.python import FLAMAFeatureModel
from flamapy.core.exceptions import FlamaException
from antlr4 import CommonTokenStream, FileStream
from uvl.UVLCustomLexer import UVLCustomLexer
from uvl.UVLPythonParser import UVLPythonParser
from antlr4.error.ErrorListener import ErrorListener
from flamapy.core.discover import DiscoverMetamodels
from flamapy.metamodels.fm_metamodel.transformations import GlencoeReader, AFMReader, FeatureIDEReader, JSONReader, XMLReader, UVLReader, GlencoeWriter
from flamapy.metamodels.configuration_metamodel.models import Configuration
from collections import defaultdict

fm = None
  
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

        return json.dumps({'valid': True, 'modelInformation': get_model_information()})
    except Exception as e:
        error_message = str(e)
        return json.dumps({'valid': False, 'errors': [error_message]})

        
def get_model_information():
    model_information = dict()

    model_information['Average Branching Factor'] = fm.average_branching_factor()
    model_information['Leaf Number'] = fm.count_leafs()
    model_information['Estimated Number of Configurations'] = fm.estimated_number_of_configurations()
    model_information['Max Depth'] = fm.max_depth()
    model_information['Atomic Sets'] = fm.atomic_sets()
    model_information['Core Features'] = fm.core_features()
    model_information['Leaf Features'] = fm.leaf_features()
    return model_information

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
    # Get and print the result
    result = operation.get_result()
    if type(result) is list:
        return json.dumps([str(conf) for conf in result])
    if isinstance(result,defaultdict):
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

    result = dm.use_transformation_m2t(feature_model,'import.uvl')
    os.remove("import.uvl")
    return result

def feature_tree(node):
    res = dict()
    res['name'] = node.name
    res['attributes'] = dict()
    res['attributes']['isMandatory'] = node.is_mandatory()
    res['attributes']['isOptional'] = node.is_optional()
    res['attributes']['isAbstract'] = node.is_abstract
    if node.get_children():
        res['attributes']['isAlternativeGroup'] = node.is_alternative_group()
        res['attributes']['isOrGroup'] = node.is_or_group()
        res['children'] = [feature_tree(child) for child in node.get_children()]
    return res

def get_features():
    if fm:
        features = [feature.name for feature in fm.fm_model.get_features()]
        return features

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