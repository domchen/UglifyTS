"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var Utils = require("./Utils");
function createMap() {
    var map = Object.create(null);
    map["__"] = undefined;
    delete map["__"];
    return map;
}
function generate(rootFileNames, compilerOptions, baseDir, outDir) {
    var cachedValue = createMap();
    var cachedKey = createMap();
    var textCount = 0;
    function getReplacement(key) {
        if (cachedKey[key]) {
            return key;
        }
        var value = cachedValue[key];
        if (value) {
            return value;
        }
        cachedValue[key] = value = "$" + textCount++;
        cachedKey[value] = key;
        return value;
    }
    var files = {};
    rootFileNames.forEach(function (fileName) {
        files[fileName] = { version: 0, content: fs.readFileSync(fileName).toString() };
    });
    var servicesHost = {
        getScriptFileNames: function () { return rootFileNames; },
        getScriptVersion: function (fileName) {
            var cache = files[fileName];
            if (cache) {
                return cache.version.toString();
            }
            return undefined;
        },
        getScriptSnapshot: function (fileName) {
            var cache = files[fileName];
            if (cache) {
                return ts.ScriptSnapshot.fromString(cache.content);
            }
            if (!fs.existsSync(fileName)) {
                return undefined;
            }
            return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
        },
        getCurrentDirectory: function () { return process.cwd(); },
        getCompilationSettings: function () { return compilerOptions; },
        getDefaultLibFileName: function (options) { return ts.getDefaultLibFilePath(options); },
    };
    var services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
    var diagnostics = services.getCompilerOptionsDiagnostics();
    rootFileNames.forEach(function (fileName) {
        services.getSemanticDiagnostics(fileName);
        diagnostics.concat(services.getSemanticDiagnostics(fileName));
        diagnostics.concat(services.getSyntacticDiagnostics(fileName));
    });
    if (diagnostics.length > 0) {
        diagnostics.forEach(function (diagnostic) {
            var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            if (diagnostic.file) {
                var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                console.log("  Error " + diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message);
            }
            else {
                console.log("  Error: " + message);
            }
        });
        process.exit(1);
    }
    var renameActions = createMap();
    var sourceFiles = services.getProgram().getSourceFiles();
    sourceFiles.forEach(visitFile);
    for (var _i = 0, rootFileNames_1 = rootFileNames; _i < rootFileNames_1.length; _i++) {
        var fileName = rootFileNames_1[_i];
        var fileCache = files[fileName];
        var outPath = path.relative(baseDir, fileName);
        outPath = path.resolve(outDir, outPath);
        Utils.writeFileTo(outPath, fileCache.content);
    }
    function visitFile(sourceFile) {
        renameActions = createMap();
        var fileName = sourceFile.fileName;
        if (fileName.substr(fileName.length - 5, 5) == ".d.ts") {
            return;
        }
        var statements = sourceFile.statements;
        var length = statements.length;
        for (var i = 0; i < length; i++) {
            var statement = statements[i];
            visitStatement(statements[i]);
        }
        for (var filePath in renameActions) {
            var actions = renameActions[filePath];
            actions.sort(function (a, b) {
                return b.start - a.start;
            });
            var fileCache = files[filePath];
            var content = fileCache.content;
            var lastPos = -1;
            for (var _i = 0, actions_1 = actions; _i < actions_1.length; _i++) {
                var action = actions_1[_i];
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
    function visitStatement(statement) {
        if (!statement) {
            return;
        }
        switch (statement.kind) {
            case ts.SyntaxKind.ClassDeclaration:
                visitDeclaration(statement);
                break;
            case ts.SyntaxKind.VariableStatement:
                var variables = statement.declarationList;
                if (variables) {
                    variables.declarations.forEach(function (declaration) {
                        renameTarget(declaration.name);
                    });
                }
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                renameTarget(statement.name);
                break;
            case ts.SyntaxKind.TypeAliasDeclaration:
                renameTarget(statement.name);
                break;
            case ts.SyntaxKind.EnumDeclaration:
                visitDeclaration(statement);
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                visitDeclaration(statement);
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                visitModule(statement);
                break;
            case ts.SyntaxKind.Block:
                visitBlock(statement);
                break;
            case ts.SyntaxKind.IfStatement:
                var ifStatement = statement;
                visitStatement(ifStatement.thenStatement);
                visitStatement(ifStatement.elseStatement);
                break;
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.WithStatement:
                var doStatement = statement;
                visitStatement(doStatement.statement);
                break;
            case ts.SyntaxKind.ForStatement:
                var forStatement = statement;
                visitStatement(forStatement.statement);
                break;
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
                var forInStatement = statement;
                visitStatement(forInStatement.statement);
                break;
            case ts.SyntaxKind.SwitchStatement:
                var switchStatment = statement;
                switchStatment.caseBlock.clauses.forEach(function (element) {
                    element.statements.forEach(function (element) {
                        visitStatement(element);
                    });
                });
                break;
            case ts.SyntaxKind.LabeledStatement:
                visitStatement(statement.statement);
                break;
            case ts.SyntaxKind.TryStatement:
                var tryStatement = statement;
                visitBlock(tryStatement.tryBlock);
                visitBlock(tryStatement.finallyBlock);
                if (tryStatement.catchClause) {
                    visitBlock(tryStatement.catchClause.block);
                }
                break;
        }
    }
    function visitModule(module) {
        if (!module) {
            return;
        }
        if (module.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            visitModule(module.body);
            return;
        }
        if (module.body.kind === ts.SyntaxKind.ModuleBlock) {
            for (var _i = 0, _a = module.body.statements; _i < _a.length; _i++) {
                var statement = _a[_i];
                visitStatement(statement);
            }
        }
    }
    function visitBlock(block) {
        if (!block) {
            return;
        }
        for (var _i = 0, _a = block.statements; _i < _a.length; _i++) {
            var statement = _a[_i];
            visitStatement(statement);
        }
    }
    function visitDeclaration(node) {
        renameTarget(node.name);
        var members = node.members;
        if (!members) {
            return;
        }
        for (var _i = 0, members_1 = members; _i < members_1.length; _i++) {
            var member = members_1[_i];
            renameTarget(member.name);
        }
    }
    function renameTarget(node) {
        if (!node) {
            return;
        }
        var file = node.getSourceFile();
        var fileName = file.fileName;
        var pos = node.getStart(file, false);
        var info = services.getRenameInfo(fileName, pos);
        if (!info.canRename) {
            return;
        }
        var replacement = getReplacement(info.displayName);
        if (replacement != info.displayName) {
            var locations = services.findRenameLocations(fileName, pos, true, false);
            for (var i = locations.length - 1; i >= 0; i--) {
                var location_1 = locations[i];
                var fileCache = files[location_1.fileName];
                if (!fileCache) {
                    continue;
                }
                var textSpan = location_1.textSpan;
                var action = { start: textSpan.start, length: textSpan.length, replacement: replacement };
                var actionList = renameActions[location_1.fileName];
                if (!actionList) {
                    actionList = renameActions[location_1.fileName] = [];
                }
                actionList.push(action);
            }
        }
    }
}
exports.generate = generate;
