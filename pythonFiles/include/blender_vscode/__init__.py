import bpy
import sys
from pathlib import Path
from .environment import scripts_folder 

def startup(editor_address, addons_to_load, modules_to_load, allow_modify_external_python):
    if bpy.app.version < (2, 80, 34):
        handle_fatal_error("Please use a newer version of Blender")

    from . import installation
    installation.ensure_packages_are_installed(
        ["debugpy", "flask", "requests"],
        allow_modify_external_python)

    from . import load_addons
    
    # Addons mapping
    addons_dir = Path(scripts_folder ,"addons")
    addons_folders = [ str(d) for d in addons_dir.glob("*") if Path(d,"__init__.py").is_file()] 
    path_mappings =  [{"src": f, "load": f} for f in addons_folders]


    # Module mapping
    modules_dir = Path(scripts_folder ,"modules")
    # TODO: Find a cleaner way
    path_mappings.extend([{"src": str(f), "load": str(f)} for f in modules_dir.rglob("*.py")])


    for mapping in path_mappings:
        print(f"mapping item:  {mapping}")

    from . import communication
    communication.setup(editor_address, path_mappings)

    load_addons.load(addons_to_load)

    from . import ui
    from . import operators

    ui.register()
    operators.register()

def handle_fatal_error(message):
    print()
    print("#"*80)
    for line in message.splitlines():
        print(">  ", line)
    print("#"*80)
    print()
    sys.exit(1)
