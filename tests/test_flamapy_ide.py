import pytest
import json
from public.flamapy.flamapy_ide import process_uvl_file, execute_pysat_operation, feature_tree, execute_configurator_operation, execute_export_transformation, execute_import_transformation, get_model_information

# Test to process a UVL file (valid)
def test_process_uvl_file_valid():
    file_path = './tests/test_models/uvlfile.uvl'
    result = process_uvl_file(file_path)
    result_data = json.loads(result)
    assert result_data['valid'] == True
    assert 'modelInformation' in result_data

# Test to process a UVL file (invalid)
def test_process_uvl_file_invalid():
    file_path = './tests/test_models/invalidfile.uvl'
    result = process_uvl_file(file_path)

    result_data = json.loads(result)
    assert result_data['valid'] == False
    assert 'errors' in result_data

# Test to get model information
def test_get_model_information():
    file_path = './tests/test_models/uvlfile.uvl'
    process_uvl_file(file_path)  

    result = get_model_information()

    assert result['Average Branching Factor'] == 2
    assert result['Leaf Number'] == 2
    assert result['Estimated Number of Configurations'] == 4
    assert result['Max Depth'] == 1
    assert result['Atomic Sets'] == [['A'], ['B'], ['C']]
    assert result['Core Features'] == ['A']
    assert result['Leaf Features'] == ['B', 'C']

# Test PySAT operation
@pytest.mark.parametrize('operation,expected', [('PySATConfigurations', ['A', 'A, C', 'A, B, C']),
                                                ('PySATConfigurationsNumber', 3), ('PySATDeadFeatures', []),
                                                ('PySATSatisfiable', True),
                                                ('BDDConfigurationsNumber', 3), ('BDDHomogeneity', 2/3),
                                                ('BDDVariantFeatures', ['B','C'])])
def test_execute_pysat_operation(operation,expected):
    file_path = './tests/test_models/uvlfile.uvl'
    process_uvl_file(file_path)  
    result = execute_pysat_operation(operation)

    assert isinstance(result, (list, str, int, float))
    assert json.loads(result) == expected

# Test export transformation
@pytest.mark.parametrize('format',['afm','json','gfm.json','sxfm','uvl'])
def test_execute_export_transformation(format):
    result = execute_export_transformation(format)

    assert result is not None

# Test import transformation
@pytest.mark.parametrize('file_extension,file_path', [('xml', './tests/test_models/requires.xml'),
                                                      ('gfm.json', './tests/test_models/Truck.gfm.json'),
                                                      ('uvl','./tests/test_models/uvlfile.uvl')])
def test_execute_import_transformation(file_extension, file_path):
    with open(file_path) as file:
        file_content = file.read()  

    result = execute_import_transformation(file_extension, file_content)

    assert result is not None

# Test configurator operation
@pytest.mark.parametrize('config,expected', [({'A': False}, False),
                                            ({'A': True,'B': False}, True)])
def test_execute_configurator_operation(config, expected):

    result = execute_configurator_operation('PySATSatisfiableConfiguration', config)

    assert isinstance(result, bool)
    assert result is expected

def test_feature_tree():
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    
    from public.flamapy.flamapy_ide import fm
    root = fm.fm_model.root
    
    result = feature_tree(root)
    
    assert result['name'] == root.name, "Root name does not match"
    assert result['attributes']['isMandatory'] == root.is_mandatory(), "isMandatory attribute does not match"
    assert result['attributes']['isOptional'] == root.is_optional(), "isOptional attribute does not match"
    assert result['attributes']['isAbstract'] == root.is_abstract, "isAbstract attribute does not match"