import sys
import traceback

from pathlib import Path

import bpy

include_dir = Path(__file__).parent / "include"
sys.path.append(str(include_dir))

from blender_vscode import communication, installation, operators, ui, load_addons, handle_fatal_error, environment

if __name__ == '__main__':
    try:
        # Ensure blender version compatibility
        if bpy.app.version < (2, 80, 34):
            handle_fatal_error("Please use a newer version of Blender")

        # Blender_vscode depenencies installation
        installation.ensure_packages_are_installed(["debugpy", "flask", "requests"],
                                                environment.allow_modify_external_python)

        # Debug folder mapping setup
        if environment.enable_user_script_folder:
            print("Debugging USER_SCRIPT_FOLDER.")
            script_dir = Path(environment.scripts_folder)
            path_mapping = [{"src": str(script_dir), "load": str(script_dir)}]
        else:
            path_mapping = load_addons.setup_addon_links(environment.addons_to_load)

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
