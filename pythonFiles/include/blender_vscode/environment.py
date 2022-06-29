import bpy
import sys
import addon_utils
from pathlib import Path
import platform
import os
import json

python_path = Path(sys.executable)
blender_path = Path(bpy.app.binary_path)
blender_directory = blender_path.parent

# Test for MacOS app bundles
if platform.system()=='Darwin':
    use_own_python = blender_directory.parent in python_path.parents
else:
    use_own_python = blender_directory in python_path.parents

version = bpy.app.version
default_script_folder = blender_path.parent / f"{version[0]}.{version[1]}" / "scripts" 
enable_user_script_folder = os.environ['ENABLE_USER_SCRIPT_FOLDER'] == "yes"
editor_address = f"http://localhost:{os.environ['EDITOR_PORT']}"
allow_modify_external_python = os.environ['ALLOW_MODIFY_EXTERNAL_PYTHON'] == "yes"
addons_to_load = tuple(map(lambda x: (Path(x["load_dir"]), x["module_name"]),
                               json.loads(os.environ['ADDONS_TO_LOAD'])))

if enable_user_script_folder:
    scripts_folder = os.environ.get('BLENDER_USER_SCRIPTS')
else:
    scripts_folder = default_script_folder 

user_addon_directory = Path(bpy.utils.user_resource('SCRIPTS', path="addons"))
addon_directories = tuple(map(Path, addon_utils.paths()))
