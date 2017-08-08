//////////////////////////////////////////////////////////////////////////////////////
//
//  The MIT License (MIT)
//
//  Copyright (c) 2017-present, Dom Chen.
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

interface SourceFileCache {
    version:number;
    content:string;
}

interface RenameAction {
    start?:number;
    length?:number;
    replacement?:string;
}

function createMap<T>():MapLike<T> {
    const map:MapLike<T> = Object.create(null);
    // Using 'delete' on an object causes V8 to put the object in dictionary mode.
    // This disables creation of hidden classes, which are expensive when an object is
    // constantly changing shape.
    map["__"] = undefined;
    delete map["__"];
    return map;
}

export function generate(rootFileNames:string[], compilerOptions:ts.CompilerOptions, baseDir:string, outDir:string):void {
    let cachedValue:MapLike<string> = createMap<string>();
    let cachedKey:MapLike<string> = createMap<string>();
    let textCount = 0;

    function getReplacement(key:string) {
        if (cachedKey[key]) {
            return key;
        }
        let value = cachedValue[key];
        if (value) {
            return value;
        }
        cachedValue[key] = value = "$" + textCount++;
        cachedKey[value] = key;
        return value;
    }


    const files:ts.Map<SourceFileCache> = <any>{};

    // initialize the list of files
    rootFileNames.forEach(fileName => {
        files[fileName] = {version: 0, content: fs.readFileSync(fileName).toString()};
    });

    // Create the language service host to allow the LS to communicate with the host
    const servicesHost:ts.LanguageServiceHost = {
        getScriptFileNames: () => rootFileNames,
        getScriptVersion: (fileName) => {
            let cache = files[fileName];
            if (cache) {
                return cache.version.toString();
            }
            return undefined;
        },
        getScriptSnapshot: (fileName) => {
            let cache = files[fileName];
            if (cache) {
                return ts.ScriptSnapshot.fromString(cache.content);
            }
            if (!fs.existsSync(fileName)) {
                return undefined;
            }
            return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
        },
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => compilerOptions,
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    };

    // Create the language service files
    const services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

    let diagnostics:ts.Diagnostic[] = services.getCompilerOptionsDiagnostics();
    // First time around, check diagnostics of all files
    rootFileNames.forEach(fileName => {
        services.getSemanticDiagnostics(fileName);
        diagnostics.concat(services.getSemanticDiagnostics(fileName));
        diagnostics.concat(services.getSyntacticDiagnostics(fileName));
    });
    if (diagnostics.length > 0) {
        diagnostics.forEach(diagnostic => {
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            if (diagnostic.file) {
                let {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                console.log(`  Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
            }
            else {
                console.log(`  Error: ${message}`);
            }
        });
        process.exit(1);
    }

    let renameActions:MapLike<RenameAction[]> = createMap<RenameAction[]>();
    let sourceFiles = services.getProgram().getSourceFiles();
    sourceFiles.forEach(visitFile);


    for (let fileName of rootFileNames) {
        let fileCache = files[fileName];
        let outPath = path.relative(baseDir, fileName);
        outPath = path.resolve(outDir, outPath);

        Utils.writeFileTo(outPath, fileCache.content);
    }


    function visitFile(sourceFile:ts.SourceFile):void {
        renameActions = createMap<RenameAction[]>();
        let fileName = sourceFile.fileName;
        if (fileName.substr(fileName.length - 5, 5) == ".d.ts") {
            return;
        }
        let statements = sourceFile.statements;
        let length = statements.length;
        for (let i = 0; i < length; i++) {
            let statement = statements[i];
            visitStatement(statements[i]);
        }

        for (let filePath in renameActions) {
            let actions = renameActions[filePath];
            actions.sort((a:RenameAction, b:RenameAction):number => {
                return b.start - a.start;
            });
            let fileCache = files[filePath];
            let content:string = fileCache.content;
            let lastPos = -1;
            for (let action of actions) {
                if (action.start == lastPos) {
                    continue;
                }
                lastPos = action.start;
                content = content.substring(0, action.start) + action.replacement +
                    content.substring(action.start + action.length);
            }
            fileCache.content = content;
            fileCache.version++;
        }
    }

    function visitStatement(statement:ts.Statement):void {
        if (!statement) {
            return;
        }
        switch (statement.kind) {
            case ts.SyntaxKind.ClassDeclaration:
                visitDeclaration(<ts.ClassDeclaration>statement);
                break;
            case ts.SyntaxKind.VariableStatement:
                const variables = (<ts.VariableStatement>statement).declarationList;
                if (variables) {
                    variables.declarations.forEach(declaration => {
                        renameTarget(declaration.name);
                    });
                }
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                renameTarget((<ts.FunctionDeclaration>statement).name);
                break;
            case ts.SyntaxKind.TypeAliasDeclaration:
                renameTarget((<ts.TypeAliasDeclaration>statement).name);
                break;
            case ts.SyntaxKind.EnumDeclaration:
                visitDeclaration((<ts.EnumDeclaration>statement));
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                visitDeclaration((<ts.InterfaceDeclaration>statement));
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                visitModule(<ts.ModuleDeclaration>statement);
                break;
            case ts.SyntaxKind.Block:
                visitBlock(<ts.Block>statement);
                break;
            case ts.SyntaxKind.IfStatement:
                const ifStatement = <ts.IfStatement>statement;
                visitStatement(ifStatement.thenStatement);
                visitStatement(ifStatement.elseStatement);
                break;
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.WithStatement:
                const doStatement = <ts.DoStatement>statement;
                visitStatement(doStatement.statement);
                break;
            case ts.SyntaxKind.ForStatement:
                const forStatement = <ts.ForStatement>statement;
                visitStatement(forStatement.statement);
                break;
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
                const forInStatement = <ts.ForInStatement>statement;
                visitStatement(forInStatement.statement);
                break;
            case ts.SyntaxKind.SwitchStatement:
                const switchStatment = <ts.SwitchStatement>statement;
                switchStatment.caseBlock.clauses.forEach(element => {
                    (<ts.DefaultClause>element).statements.forEach(element => {
                        visitStatement(element);
                    })
                });
                break;
            case ts.SyntaxKind.LabeledStatement:
                visitStatement((<ts.LabeledStatement>statement).statement);
                break;
            case ts.SyntaxKind.TryStatement:
                const tryStatement = <ts.TryStatement>statement;
                visitBlock(tryStatement.tryBlock);
                visitBlock(tryStatement.finallyBlock);
                if (tryStatement.catchClause) {
                    visitBlock(tryStatement.catchClause.block);
                }
                break;
        }
    }

    function visitModule(module:ts.ModuleDeclaration):void {
        if (!module) {
            return;
        }
        if (module.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            visitModule(<ts.ModuleDeclaration>module.body);
            return;
        }
        if (module.body.kind === ts.SyntaxKind.ModuleBlock) {
            for (let statement of (<ts.ModuleBlock>module.body).statements) {
                visitStatement(statement);
            }
        }

    }

    function visitBlock(block:ts.Block):void {
        if (!block) {
            return;
        }
        for (let statement of block.statements) {
            visitStatement(statement);
        }
    }

    function visitDeclaration(node:ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration):void {
        renameTarget(node.name);
        let members = node.members;
        if (!members) {
            return;
        }
        for (let member of members) {
            renameTarget(member.name);
        }
    }

    function renameTarget(node:ts.Node) {
        if (!node) {
            return;
        }
        const file = node.getSourceFile();
        const fileName = file.fileName;
        const pos = node.getStart(file, false);
        const info = services.getRenameInfo(fileName, pos);
        if (!info.canRename) {
            return;
        }
        const replacement = getReplacement(info.displayName);
        if (replacement != info.displayName) {
            const locations = services.findRenameLocations(fileName, pos, true, false);
            for (let i = locations.length - 1; i >= 0; i--) {
                let location = locations[i];
                let fileCache:SourceFileCache = files[location.fileName];
                if (!fileCache) {
                    continue;
                }
                let textSpan = location.textSpan;
                let action:RenameAction = {start: textSpan.start, length: textSpan.length, replacement: replacement};
                let actionList = renameActions[location.fileName];
                if (!actionList) {
                    actionList = renameActions[location.fileName] = [];
                }
                actionList.push(action);
            }
        }
    }
}
