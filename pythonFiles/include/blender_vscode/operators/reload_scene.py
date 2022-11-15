import bpy
import sys
import traceback
import logging
from bpy.props import *
from .. utils import redraw_all
from .. communication import send_dict_as_json, register_post_action
import importlib

def reload_scene_action(data):
    try:
        logging.info("Reloading the scene")
        bpy.ops.wm.revert_mainfile()
    except Exception:
        logging.warning("No scene to reload")

def register():
    register_post_action("reload_scene", reload_scene_action)
