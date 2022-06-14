import bpy
import sys
import traceback
from bpy.props import *
from .. utils import redraw_all
from .. communication import send_dict_as_json, register_post_action
import importlib

class UpdateModuleOperator(bpy.types.Operator):
    bl_idname = "dev.update_module"
    bl_label = "Update Module"

    module_name: StringProperty()

    def execute(self, context):
        print("Update modules")

        for name in list(sys.modules.keys()):
            if name.startswith(self.module_name):
                print(f"remove {name}")
                del sys.modules[name]
                send_dict_as_json({"type" : "moduleUpdated"})            
        else:
            return {'CANCELLED'}    
        return {'FINISHED'}


def reload_module_action(data):
    for name in data["names"]:
        bpy.ops.dev.update_module(module_name=name)

def register():
    bpy.utils.register_class(UpdateModuleOperator)
    register_post_action("reload_module", reload_module_action)
