from . import addon_update
from . import module_update
from . import script_runner
from . import stop_blender

modules = (
    addon_update,
    module_update,
    script_runner,
    stop_blender,
)

def register():
    for module in modules:
        module.register()
