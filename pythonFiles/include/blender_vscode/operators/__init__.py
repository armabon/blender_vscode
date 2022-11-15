from . import addon_update
from . import module_update
from . import script_runner
from . import stop_blender
from . import reload_scene

modules = (
    addon_update,
    module_update,
    script_runner,
    stop_blender,
    reload_scene,
)

def register():
    for module in modules:
        module.register()
