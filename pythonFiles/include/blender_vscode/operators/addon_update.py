import bpy
import sys
import traceback
from bpy.props import *
import logging
from .. utils import redraw_all
from .. communication import send_dict_as_json, register_post_action

class UpdateAddonOperator(bpy.types.Operator):
    bl_idname = "dev.update_addon"
    bl_label = "Update Addon"

    module_name: StringProperty()

    def execute(self, context):
        # Only update already enabled add-ons
        if self.module_name in bpy.context.preferences.addons:
            logging.info(f"Updating addon {self.module_name}")
            try:
                print(self.module_name)
                bpy.ops.preferences.addon_disable(module=self.module_name)
            except Exception as e:
                traceback.print_exc()
                print(e)
                send_dict_as_json({"type" : "disableFailure"})
                return {'CANCELLED'}

            for name in list(sys.modules.keys()):
                if name.startswith(self.module_name):
                    del sys.modules[name]

            try:
                bpy.ops.preferences.addon_enable(module=self.module_name)
            except:
                traceback.print_exc()
                send_dict_as_json({"type" : "enableFailure"})
                return {'CANCELLED'}

            send_dict_as_json({"type" : "addonUpdated"})

            redraw_all()
            return {'FINISHED'}
        else:
            return {'CANCELLED'}

def reload_addon_action(data):
    for name in data["names"]:
        bpy.ops.dev.update_addon(module_name=name)

def register():
    bpy.utils.register_class(UpdateAddonOperator)
    register_post_action("reload", reload_addon_action)
