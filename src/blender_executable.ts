import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';

import { launchPath } from './paths';
import { getServerPort } from './communication';
import { letUserPickItem } from './select_utils';
import { getConfig, cancel, runTask, pathExists } from './utils';
import { AddonWorkspaceFolder } from './addon_folder';
import { BlenderWorkspaceFolder } from './blender_folder';
import * as fs from 'fs';


export class BlenderExecutable {
    data: BlenderPathData;

    constructor(data: BlenderPathData) {
        this.data = data;
    }

    public static async GetAny() {
        let data = await getFilteredBlenderPath({
            label: 'Blender Executable',
            selectNewLabel: 'Choose a new Blender executable...',
            predicate: () => true,
            setSettings: () => { }
        });
        return new BlenderExecutable(data);
    }

    public static async GetDebug() {
        let data = await getFilteredBlenderPath({
            label: 'Debug Build',
            selectNewLabel: 'Choose a new debug build...',
            predicate: item => item.isDebug,
            setSettings: item => { item.isDebug = true; }
        });
        return new BlenderExecutable(data);
    }

    public static async LaunchAny() {
        await (await this.GetAny()).launch();
    }

    public static async LaunchDebug(folder: BlenderWorkspaceFolder) {
        await (await this.GetDebug()).launchDebug(folder);
    }

    get path() {
        return this.data.path;
    }

    private getBlenderLaunchArgs() {
        let args = new Array();
        args.push('--python-use-system-env')
        args.push('--python', launchPath)

        if (this.data.scene != undefined && this.data.scene.length > 0){
            args.push(this.data.scene)
        }

        return args;
    }

    public async launch() {
        let execution = new vscode.ProcessExecution(
            this.path,
            this.getBlenderLaunchArgs(),
            { env: await this.getBlenderLaunchEnv() }
        );

        await runTask('blender', execution);
    }

    public async launchDebug(folder: BlenderWorkspaceFolder) {
        let configuration = {
            name: 'Debug Blender',
            type: 'cppdbg',
            request: 'launch',
            program: this.data.path,
            args: ['--debug'].concat(this.getBlenderLaunchArgs()),
            env: await this.getBlenderLaunchEnv(),
            stopAtEntry: false,
            MIMode: 'gdb',
            cwd: folder.uri.fsPath,
        };
        vscode.debug.startDebugging(folder.folder, configuration);
    }

    public async launchWithCustomArgs(taskName: string, args: string[]) {
        let execution = new vscode.ProcessExecution(
            this.path,
            args,
        );

        await runTask(taskName, execution, true);
    }

    private async getBlenderLaunchEnv() {
        let config = getConfig();
        let addons = await AddonWorkspaceFolder.All();
        let addonsLoadDirsWithNames = await Promise.all(addons.map(a => a.getLoadDirectoryAndModuleName()));
    
        const blenderEnv: { [index: string]: any } = {};
        const varsRegex : RegExp = new RegExp("\\$\{(.*?)\}");
    
        let debugUserScriptFolder = <boolean>config.get('debugUserScriptFolder');
        let userScriptForlderPath = <string>config.get('customUserScriptFolderPath');
    
        blenderEnv['EDITOR_PORT'] = getServerPort().toString();
        blenderEnv['ALLOW_MODIFY_EXTERNAL_PYTHON'] = <boolean>config.get('allowModifyExternalPython') ? 'yes' : 'no';
        blenderEnv['ADDONS_TO_LOAD'] = JSON.stringify(addonsLoadDirsWithNames);
        blenderEnv['ENABLE_USER_SCRIPT_FOLDER'] = debugUserScriptFolder ? 'yes' : 'no';
    
        if (await pathExists(userScriptForlderPath)) {
            blenderEnv['BLENDER_USER_SCRIPTS'] = userScriptForlderPath;
            console.log("Custom BLENDER_USER_SCRIPTS enabled !");
        }
    
        // If an envfile is given, inject his content
        let envFile = this.data.envFile;
        if (envFile != undefined && envFile.length > 0 && await pathExists(envFile)){
            console.log("Injecting env vars from file"+envFile);
    
            let data = fs.readFileSync(envFile, 'utf8');
             
            let lines = data.split(/\r?\n/);
            lines.forEach((line) => {
                const line_elem = line.split("=");
                if (line_elem.length === 2) {
                    let key = line_elem[0];
                    let value = line_elem[1];
                    
                    // Handle env file vars
                    let match = varsRegex.exec(value);
                    
                    while (match != null) {
                        let new_value = blenderEnv[match[1]];
                        if (new_value === undefined){
                            console.log(match[1]+"env var undefined.");
                        }
                        value = value.replace(match[0], blenderEnv[match[1]]);
                        match = varsRegex.exec(value);
                    }
                    
                    blenderEnv[key] = value;
                }
    
            });
        }
    
        return await blenderEnv;
    }
    
}

interface BlenderPathData {
    path: string;
    name: string;
    isDebug: boolean;
    scene: string;
    envFile: string;
}

interface BlenderType {
    label: string;
    selectNewLabel: string;
    predicate: (item: BlenderPathData) => boolean;
    setSettings: (item: BlenderPathData) => void;
}

async function getFilteredBlenderPath(type: BlenderType): Promise<BlenderPathData> {
    let config = getConfig();
    let allBlenderPaths = <BlenderPathData[]>config.get('executables');
    let usableBlenderPaths = allBlenderPaths.filter(type.predicate);

    let items = [];
    for (let pathData of usableBlenderPaths) {
        let useCustomName = pathData.name !== '' && pathData.name !== undefined;
        items.push({
            data: async () => pathData,
            label: useCustomName ? pathData.name : pathData.path
        });
    }

    items.push({ label: type.selectNewLabel, data: async () => askUser_FilteredBlenderPath(type) });

    let item = await letUserPickItem(items);
    let pathData: BlenderPathData = await item.data();

    if (allBlenderPaths.find(data => data.path === pathData.path) === undefined) {
        allBlenderPaths.push(pathData);
        config.update('executables', allBlenderPaths, vscode.ConfigurationTarget.Global);
    }

    return pathData;
}

async function askUser_FilteredBlenderPath(type: BlenderType): Promise<BlenderPathData> {
    let filepath = await askUser_BlenderPath(type.label);
    let pathData: BlenderPathData = {
        path: filepath,
        name: '',
        isDebug: false,
        scene: '',
        envFile: '',
    };
    type.setSettings(pathData);
    return pathData;
}

async function askUser_BlenderPath(openLabel: string) {
    let value = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: openLabel
    });
    if (value === undefined) return Promise.reject(cancel());
    let filepath = value[0].fsPath;

    if (os.platform() === 'darwin') {
        if (filepath.toLowerCase().endsWith('.app')) {
            filepath += '/Contents/MacOS/blender';
        }
    }

    await testIfPathIsBlender(filepath);
    return filepath;
}

async function testIfPathIsBlender(filepath: string) {
    let name: string = path.basename(filepath);

    if (!name.toLowerCase().startsWith('blender')) {
        return Promise.reject(new Error('Expected executable name to begin with \'blender\''));
    }

    let testString = '###TEST_BLENDER###';
    let command = `"${filepath}" --factory-startup -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;

    return new Promise<void>((resolve, reject) => {
        child_process.exec(command, {}, (err, stdout, stderr) => {
            let text = stdout.toString();
            if (!text.includes(testString)) {
                var message = 'A simple check to test if the selected file is Blender failed.';
                message += ' Please create a bug report when you are sure that the selected file is Blender 2.8 or newer.';
                message += ' The report should contain the full path to the executable.';
                reject(new Error(message));
            }
            else {
                resolve();
            }
        });
    });
}

