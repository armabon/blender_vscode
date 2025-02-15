'use strict';

import * as vscode from 'vscode';
import { getConfig, handleErrors } from './utils';
import { COMMAND_newAddon } from './new_addon';
import { COMMAND_newOperator } from './new_operator';
import { AddonWorkspaceFolder, ModuleWorkspaceFolder } from './addon_folder';
import { BlenderExecutable } from './blender_executable';
import { BlenderWorkspaceFolder } from './blender_folder';
import { startServer, stopServer, RunningBlenders } from './communication';
import {
    COMMAND_runScript, COMMAND_newScript, COMMAND_setScriptContext,
    COMMAND_openScriptsFolder
} from './scripts';

export function activate(context: vscode.ExtensionContext) {
    let commands: [string, () => Promise<void>][] = [
        ['blender.start', COMMAND_start],
        ['blender.stop', COMMAND_stop],
        ['blender.build', COMMAND_build],
        ['blender.buildAndStart', COMMAND_buildAndStart],
        ['blender.startWithoutCDebugger', COMMAND_startWithoutCDebugger],
        ['blender.buildPythonApiDocs', COMMAND_buildPythonApiDocs],
        ['blender.reloadAddons', COMMAND_reloadAddons],
        ['blender.newAddon', COMMAND_newAddon],
        ['blender.newScript', COMMAND_newScript],
        ['blender.openScriptsFolder', COMMAND_openScriptsFolder],
    ];

    let textEditorCommands: [string, () => Promise<void>][] = [
        ['blender.runScript', COMMAND_runScript],
        ['blender.setScriptContext', COMMAND_setScriptContext],
        ['blender.newOperator', COMMAND_newOperator],
    ];

    let disposables = [
        vscode.workspace.onDidSaveTextDocument(HANDLER_updateOnSave),
    ];

    for (let [identifier, func] of commands) {
        let command = vscode.commands.registerCommand(identifier, handleErrors(func));
        disposables.push(command);
    }

    for (let [identifier, func] of textEditorCommands) {
        let command = vscode.commands.registerTextEditorCommand(identifier, handleErrors(func));
        disposables.push(command);
    }

    context.subscriptions.push(...disposables);

    startServer();
}

export function deactivate() {
    stopServer();
}


/* Commands
 *********************************************/

async function COMMAND_buildAndStart() {
    await COMMAND_build();
    await COMMAND_start();
}

async function COMMAND_start() {
    let blenderFolder = await BlenderWorkspaceFolder.Get();
    if (blenderFolder === null) {
        await BlenderExecutable.LaunchAny();
    }
    else {
        await BlenderExecutable.LaunchDebug(blenderFolder);
    }
}

async function COMMAND_stop() {
    RunningBlenders.sendToAll({ type: 'stop' });
}

async function COMMAND_build() {
    await rebuildAddons(await AddonWorkspaceFolder.All());

    let blenderFolder = await BlenderWorkspaceFolder.Get();
    if (blenderFolder !== null) {
        await blenderFolder.buildDebug();
    }
}

async function COMMAND_startWithoutCDebugger() {
    await BlenderExecutable.LaunchAny();
}

async function COMMAND_buildPythonApiDocs() {
    let folder = await BlenderWorkspaceFolder.Get();
    if (folder === null) {
        vscode.window.showInformationMessage('Cannot generate API docs without Blender source code.');
        return;
    }
    let part = await vscode.window.showInputBox({ placeHolder: 'part' });
    if (part === undefined) return;
    await folder.buildPythonDocs(part);
}

let isSavingForReload = false;

async function COMMAND_reloadAddons() {
    isSavingForReload = true;
    await vscode.workspace.saveAll(false);
    isSavingForReload = false;
    await reloadAddons(await AddonWorkspaceFolder.All());
}

async function reloadAddons(addons: AddonWorkspaceFolder[]) {
    if (addons.length === 0) return;
    let instances = await RunningBlenders.getResponsive();
    if (instances.length === 0) return;

    await rebuildAddons(addons);
    let names = await Promise.all(addons.map(a => a.getModuleName()));
    instances.forEach(instance => instance.post({ type: 'reload', names: names }));
}

async function reloadModules(modules: ModuleWorkspaceFolder[]) {
    if (modules.length === 0) return;
    let instances = await RunningBlenders.getResponsive();
    if (instances.length === 0) return;

    let names = await Promise.all(modules.map(m => m.getModuleName()));
    
    let additionnalModules = <string[]>getConfig().get('externalModulesToReload');
    for (let module of additionnalModules) {
        names.push(module);
    }

    instances.forEach(instance => instance.post({ type: 'reload_module', names: names }));
}

async function reloadScene() {
    let instances = await RunningBlenders.getResponsive();
    if (instances.length === 0) return;

    instances.forEach(instance => instance.post({ type: 'reload_scene'}));
}


async function rebuildAddons(addons: AddonWorkspaceFolder[]) {
    await Promise.all(addons.map(a => a.buildIfNecessary()));
}


/* Event Handlers
 ***************************************/

async function HANDLER_updateOnSave(document: vscode.TextDocument) {
    if (isSavingForReload) return;
    let modules = await ModuleWorkspaceFolder.All();
    await reloadModules(modules.filter(m => m.reloadOnSave));
    let addons = await AddonWorkspaceFolder.All();
    await reloadAddons(addons.filter(a => a.reloadOnSave));

    let doReloadScene = <boolean[]>getConfig().get('reloadScene');
    if (doReloadScene){
        await reloadScene();
    }

}
