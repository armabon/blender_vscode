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

    return load_addons.setup_addon_links(addons_to_load)


try:
    # Ensure blender version compatibility
    if bpy.app.version < (2, 80, 34):
        handle_fatal_error("Please use a newer version of Blender")

    # Blender_vscode depenencies installation
    installation.ensure_packages_are_installed(["debugpy", "flask", "requests"],
                                               environment.allow_modify_external_python)

    # Debug folder mapping setup
    if environment.enable_user_script_folder:
        print("Debug user script folder enabled.")
        path_mapping = get_user_scripts_folder_path_mapping()
    else:
        path_mapping = get_addons_path_mapping(environment.addons_to_load)

    communication.setup(environment.editor_address, path_mapping)

    # Enabling addons
    load_addons.load(environment.addons_to_load)

    # Register UI panels and Operators
    ui.register()
    operators.register()

except Exception as e:
    if type(e) is not SystemExit:
        traceback.print_exc()
        sys.exit()
