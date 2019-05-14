import {workspace, window, Disposable, Range, TextDocument, Diagnostic, DiagnosticSeverity, DiagnosticCollection, languages} from "vscode";
import * as child from 'child_process';
import BaseLinter from "./BaseLinter";
import * as path from 'path';

//var isWindows = process.platform === "win32";

export default class ModelsimLinter extends BaseLinter {
    private xceliumArgs: string;
    private xceliumPath: string;
    private xceliumIncludeFiledir: boolean;

    constructor() {
        super("xcelium");
        workspace.onDidChangeConfiguration(() => {
            this.getConfig();
        })
        this.getConfig();
    }

    private getConfig() {
        //get custom arguments
        this.xceliumArgs = <string>workspace.getConfiguration().get('verilog.linting.xcelium.arguments');
        this.xceliumPath = <string>workspace.getConfiguration().get('verilog.linting.xcelium.path');
        this.xceliumIncludeFiledir = <boolean>workspace.getConfiguration().get('verilog.linting.xcelium.includeFiledir');
    }

    protected lint(doc: TextDocument) {
        let command: string = this.xceliumPath + ' -compile -nocopyright -Q ' + doc.fileName + ' ' + this.xceliumArgs;     //command to execute
        if (this.xceliumIncludeFiledir) {
            command += '-incdir ' + path.dirname(doc.fileName);
        }
        var process: child.ChildProcess = child.exec(command, {cwd:workspace.rootPath}, (error:Error, stdout: string, stderr: string) => {
            let diagnostics: Diagnostic[] = [];
            let lines = stdout.split(/\r?\n/g);

            let regexExp = "^\\s*(\\w+)\\s*:\\s*\\*([WEF]),(\\w+)\\s*\\(([^ ]+),([0-9]+)\\|([0-9]+)\\):?\\s*(.*)";
            //let regexExp = "^\\*\\* (((Error)|(Warning))( \\(suppressible\\))?: )(\\([a-z]+-[0-9]+\\) )?([^\\(]*)\\(([0-9]+)\\): (\\([a-z]+-[0-9]+\\) )?((((near|Unknown identifier|Undefined variable):? )?[\"\']([\\w:;\\.]+)[\"\'][ :.]*)?.*)";
            // Parse output lines
            lines.forEach((line, i) => {
                let sev: DiagnosticSeverity;
                let m = line.match(regexExp);
                try {
                    if( m ) {
                        if( m[4] != doc.fileName)
                            return;
                        switch (m[2]) {
                            case "E":
                            case "F":
                                sev = DiagnosticSeverity.Error;
                                break;
                            case "W":
                                sev = DiagnosticSeverity.Warning;
                                break;
                            default:
                                sev = DiagnosticSeverity.Information;
                                break;
                        }
                        let lineNum = parseInt(m[5])-1;
                        let msg = m[7];
                        diagnostics.push({
                            severity: sev,
                            range:new Range(lineNum, 0, lineNum, Number.MAX_VALUE),
                            message: msg,
                            code: 'xcelium',
                            source: 'xcelium'
                        });
                    }
                }
                catch (e) {
                    diagnostics.push({
                        severity: sev,
                        range:new Range(0, 0, 0, Number.MAX_VALUE),
                        message: line,
                        code: 'xcelium',
                        source: 'xcelium'
                    });
                }
            })
            this.diagnostic_collection.set(doc.uri, diagnostics);
        })
    }
}