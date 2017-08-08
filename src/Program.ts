//////////////////////////////////////////////////////////////////////////////////////
//
//  The MIT License (MIT)
//
//  Copyright (c) 2017-present, Dom Chen
//  All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy of
//  this software and associated documentation files (the "Software"), to deal in the
//  Software without restriction, including without limitation the rights to use, copy,
//  modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
//  and to permit persons to whom the Software is furnished to do so, subject to the
//  following conditions:
//
//      The above copyright notice and this permission notice shall be included in all
//      copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
//  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
//  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
//  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
//  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
//////////////////////////////////////////////////////////////////////////////////////

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import * as Utils from "./Utils";
import * as Obfuscate from "./Obfuscate";
import * as CommandLine from "./CommandLine";

const VERSION = "0.0.1";

export function run(args:string[]):void {
    let commandOptions = CommandLine.parse(args);
    if (commandOptions.errors.length > 0) {
        console.log(commandOptions.errors.join("\n") + "\n");
        process.exit(1);
    }

    if (commandOptions.version) {
        printVersion();
        return;
    }

    if (commandOptions.help) {
        printVersion();
        printHelp();
        return;
    }

    let configFileName:string = "";
    if (commandOptions.project) {
        if (!commandOptions.project || ts.sys.directoryExists(commandOptions.project)) {
            configFileName = Utils.joinPath(commandOptions.project, "tsconfig.json");
        }
        else {
            configFileName = commandOptions.project;
        }
        if (ts.sys.fileExists(configFileName)) {
            ts.sys.write("Cannot find a tsconfig.json file at the specified directory: " + commandOptions.project + ts.sys.newLine);
            ts.sys.exit(1);
        }
    }
    else {
        let currentDir = ts.sys.getCurrentDirectory();
        configFileName = findConfigFile(currentDir);
        if (!configFileName) {
            printVersion();
            printHelp();
            ts.sys.exit(0);
        }

    }
    let outDir = path.resolve(commandOptions.outDir);
    let config = parseOptionsFromFile(configFileName);
    if (config.errors.length > 0) {
        console.log(config.errors.join("\n") + "\n");
        process.exit(1);
    }
    Obfuscate.generate(config.fileNames, config.compilerOptions, path.dirname(configFileName),outDir);
}

function findConfigFile(searchPath:string):string {
    while (true) {
        let fileName = Utils.joinPath(searchPath, "tsconfig.json");
        if (ts.sys.fileExists(fileName)) {
            return fileName;
        }
        let parentPath = path.dirname(searchPath);
        if (parentPath === searchPath) {
            break;
        }
        searchPath = parentPath;
    }
    return "";
}

interface OptionsResult {
    compilerOptions?:ts.CompilerOptions;
    fileNames?:string[];
    errors?:string[];
}

function parseOptionsFromFile(configFileName:string):OptionsResult {
    let jsonResult = ts.parseConfigFileTextToJson(configFileName, ts.sys.readFile(configFileName));
    const configObject = jsonResult.config;
    if (!configObject) {
        let result:OptionsResult = {};
        result.errors = [Utils.formatDiagnostics([jsonResult.error])];
        return result;
    }
    let baseDir = path.dirname(configFileName);
    return parseOptionsFromJson(configObject, baseDir, configFileName);
}

function parseOptionsFromJson(jsonOptions:any, basePath:string, configFileName?:string):OptionsResult {
    let result:OptionsResult = {};
    result.errors = [];
    result.fileNames = [];
    let compilerResult = ts.convertCompilerOptionsFromJson(jsonOptions["compilerOptions"], basePath, configFileName);
    if (compilerResult.errors.length > 0) {
        result.errors.push(Utils.formatDiagnostics(compilerResult.errors));
        return result;
    }
    let compilerOptions = compilerResult.options;
    result.compilerOptions = compilerOptions;
    let outDir = basePath;
    if (compilerOptions.outDir) {
        outDir = compilerOptions.outDir;
    }
    let optionResult = ts.parseJsonConfigFileContent(jsonOptions, ts.sys, basePath);
    if (optionResult.errors.length > 0) {
        result.errors.push(Utils.formatDiagnostics(optionResult.errors));
    }
    else {
        result.fileNames = optionResult.fileNames;
    }
    return result;
}

function printVersion():void {
    console.log("Version " + VERSION + "\n");
}

function printHelp():void {
    const newLine = "\n";
    let output = "";
    output += "Syntax:   uglifyts [outDir] [options]" + newLine + newLine;
    output += "Examples: uglifyts --version" + newLine;
    output += "Examples: uglifyts ../generated/" + newLine + newLine;
    output += "Options:" + newLine;
    CommandLine.optionDeclarations.forEach(option => {
        let name = "";
        if (option.shortName) {
            name += "-" + option.shortName + ", ";
        }
        name += "--" + option.name;
        name += makePadding(25 - name.length);
        output += name + option.description + newLine;
    });
    console.log(output);
}

function makePadding(paddingLength:number):string {
    return Array(paddingLength + 1).join(" ");
}


run(process.argv.slice(2));