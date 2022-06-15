import json
import os
import sys
import traceback
from pathlib import Path

import bpy

include_dir = Path(__file__).parent / "include"
sys.path.append(str(include_dir))

from blender_vscode import communication, installation, operators, ui, load_addons, handle_fatal_error, environment


def get_user_scripts_folder_path_mapping():
    # Addons mapping
    addons_dir = Path(environment.scripts_folder, "addons")
    addons_folders = [str(d) for d in addons_dir.glob(
        "*") if Path(d, "__init__.py").is_file()]
    path_mappings = [{"src": f, "load": f} for f in addons_folders]

    # Module mapping
    modules_dir = Path(environment.scripts_folder, "modules")
    # TODO: Find a cleaner way
    path_mappings.extend([{"src": str(f), "load": str(f)}
                         for f in modules_dir.rglob("*.py")])

    for mapping in path_mappings:
        print(f"mapping item:  {mapping}")

    return path_mappings


def get_addons_path_mapping(addons_to_load):
    # print(f"loading addons: {addons_to_load}")
    # TODO: Addons path mapping
    pass


try:
    # Retrieve configuration env vars
    allow_modify_external_python = os.environ['ALLOW_MODIFY_EXTERNAL_PYTHON'] == "yes"
    editor_address = f"http://localhost:{os.environ['EDITOR_PORT']}"
    addons_to_load = tuple(map(lambda x: (Path(x["load_dir"]), x["module_name"]),
                               json.loads(os.environ['ADDONS_TO_LOAD'])))
    enable_user_script_folder = os.environ['ENABLE_USER_SCRIPT_FOLDER'] == "yes"

    # Ensure blender version compatibility
    if bpy.app.version < (2, 80, 34):
        handle_fatal_error("Please use a newer version of Blender")

    # Blender_vscode depenencies installation 
    installation.ensure_packages_are_installed(["debugpy", "flask", "requests"],
                                               allow_modify_external_python)

    # Debug folder mapping setup
    if enable_user_script_folder:
        path_mapping = get_user_scripts_folder_path_mapping()
    else:
        path_mapping = get_addons_path_mapping(addons_to_load)

    communication.setup(editor_address, path_mapping)

    # Enabling addons
    load_addons.load(addons_to_load)

    # Register UI panels and Operators
    ui.register()
    operators.register()

except Exception as e:
    if type(e) is not SystemExit:
        traceback.print_exc()
        sys.exit()
