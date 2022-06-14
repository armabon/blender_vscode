import bpy
import sys
import addon_utils
from pathlib import Path
import platform
import os

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
scripts_folder = os.environ.get('BLENDER_USER_SCRIPTS', default_script_folder) 
print(f"SCRIPT_FOLDER:{scripts_folder}")
user_addon_directory = Path(bpy.utils.user_resource('SCRIPTS', path="addons"))
addon_directories = tuple(map(Path, addon_utils.paths()))
