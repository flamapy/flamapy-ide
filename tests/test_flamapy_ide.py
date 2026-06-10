import pytest
import json
from public.flamapy.flamapy_ide import (
    process_uvl_file, execute_facade_operation,
    execute_facade_operation_with_config, feature_tree,
    execute_export_transformation,
    execute_import_transformation, get_model_information,
    get_model_information_json,
    get_configuration_distribution, get_feature_inclusion_probabilities,
)

# Test to process a UVL file (valid). Validation is intentionally cheap: model
# metrics are no longer embedded in its payload (see get_model_information_json).
def test_process_uvl_file_valid():
    file_path = './tests/test_models/uvlfile.uvl'
    result = process_uvl_file(file_path)
    result_data = json.loads(result)
    assert result_data['valid'] == True
    assert 'modelInformation' not in result_data

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

# The worker requests metrics through the JSON wrapper; it must round-trip.
def test_get_model_information_json():
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    result = json.loads(get_model_information_json())
    assert result['Leaf Number'] == 2
    assert result['Core Features'] == ['A']

# Test the generic facade dispatcher (replaces the former execute_pysat_operation path:
# analysis operations are now addressed by facade method name + optional backend).
@pytest.mark.parametrize('name,args,expected', [
    ('count_leafs', {}, 2),
    ('max_depth', {}, 1),
    ('leaf_features', {}, ['B', 'C']),
    ('atomic_sets', {}, ['A', 'B', 'C']),
    ('satisfiable', {'backend': 'sat'}, True),
    ('dead_features', {'backend': 'sat'}, []),
    ('configurations', {'backend': 'sat'}, ['A', 'A, C', 'A, B, C']),
    ('configurations_number', {'backend': 'sat'}, 3),
    ('configurations_number', {'backend': 'bdd'}, 3),
    ('homogeneity', {}, 2 / 3),
    ('variant_features', {}, ['B', 'C']),
    ('feature_ancestors', {'feature_name': 'C'}, ['A']),
    ('configurations_with_n_features', {'n': 1}, ['A']),
])
def test_execute_facade_operation(name, args, expected):
    file_path = './tests/test_models/uvlfile.uvl'
    process_uvl_file(file_path)
    result = execute_facade_operation(name, json.dumps(args))

    assert isinstance(result, str)
    parsed = json.loads(result)
    if isinstance(parsed, list) and isinstance(expected, list):
        assert sorted(parsed) == sorted(expected)
    else:
        assert parsed == expected

# Test the config-input facade dispatcher (replaces the former execute_configurator_operation
# path: the UI's {feature: value} mapping is passed straight to the facade, which accepts a
# mapping in place of a file path).
@pytest.mark.parametrize('name,config,expected', [
    ('satisfiable_configuration', {'A': True}, True),
    ('satisfiable_configuration', {'A': False}, False),
    ('satisfiable_configuration', {'A': True, 'B': False}, True),
    ('commonality', {'A': True}, 1.0),
])
def test_execute_facade_operation_with_config(name, config, expected):
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    configs = {'configuration_path': config}
    result = execute_facade_operation_with_config(name, json.dumps(configs))

    assert isinstance(result, str)
    assert json.loads(result) == expected


# Diagnosis runs from model + configuration (no test case): a selection that violates the
# B => C constraint must yield a non-empty diagnosis.
def test_execute_facade_operation_with_config_diagnosis():
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    configs = {'configuration_path': {'A': True, 'B': True, 'C': False}}
    result = execute_facade_operation_with_config('diagnosis', json.dumps(configs))

    parsed = json.loads(result)
    assert isinstance(parsed, list)
    assert any('Diagnos' in item for item in parsed)

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

def test_get_configuration_distribution():
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    result = get_configuration_distribution()
    assert 'x' in result
    assert 'y' in result
    assert 'descriptive_statistics' in result
    assert len(result['x']) == len(result['y'])
    assert isinstance(result['descriptive_statistics'], dict)


def test_get_feature_inclusion_probabilities():
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    result = get_feature_inclusion_probabilities()
    assert 'x' in result
    assert 'y' in result
    assert 'colors' in result
    assert len(result['x']) == len(result['y']) == len(result['colors'])
    assert all(0.0 <= v <= 100.0 for v in result['y'])


def test_dict_result_serializes_as_list():
    """A facade op returning a dict (feature_inclusion_probability) must serialise to a
    list of 'feature: probability' strings, not [object Object]."""
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    result = execute_facade_operation('feature_inclusion_probability')
    parsed = json.loads(result)
    assert isinstance(parsed, list)
    assert all(isinstance(item, str) and ':' in item for item in parsed)


def test_feature_tree():
    process_uvl_file('./tests/test_models/uvlfile.uvl')
    
    from public.flamapy.flamapy_ide import fm
    root = fm.fm_model.root
    
    result = feature_tree(root)
    
    assert result['name'] == root.name, "Root name does not match"
    assert result['attributes']['isMandatory'] == root.is_mandatory(), "isMandatory attribute does not match"
    assert result['attributes']['isOptional'] == root.is_optional(), "isOptional attribute does not match"
    assert result['attributes']['isAbstract'] == root.is_abstract, "isAbstract attribute does not match"