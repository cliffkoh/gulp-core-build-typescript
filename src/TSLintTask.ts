import { GulpTask } from 'gulp-core-build';
import gulpType = require('gulp');
import through2 = require('through2');
import gutil = require('gulp-util');
import tslint = require('tslint');
import * as path from 'path';
import * as lintTypes from 'tslint/lib/lint';
import * as ts from 'typescript';

export interface ITSLintTaskConfig {
  /* tslint:disable:no-any */
  lintConfig?: any;
  /* tslint:enable:no-any */
  rulesDirectory?: string | string[];
  sourceMatch?: string[];
  reporter?: (result: lintTypes.LintResult, file: gutil.File, options: ITSLintTaskConfig) => void;
}

export class TSLintTask extends GulpTask<ITSLintTaskConfig> {
  public name: string = 'tslint';
  public taskConfig: ITSLintTaskConfig = {
    lintConfig: require('../lib/defaultTslint.json'),
    reporter: (result: lintTypes.LintResult, file: gutil.File, options: ITSLintTaskConfig): void => {
      for (const failure of result.failures) {
        const pathFromRoot: string = path.relative(this.buildConfig.rootPath, file.path);

        const start: ts.LineAndCharacter = failure.getStartPosition().getLineAndCharacter();
        this.fileError(
          pathFromRoot,
          start.line + 1,
          start.character + 1,
          failure.getRuleName(),
          failure.getFailure());
      }
    },
    rulesDirectory: tslint.getRulesDirectories([ './../node_modules/tslint-microsoft-contrib' ], __dirname),
    sourceMatch: [
      'src/**/*.ts',
      'src/**/*.tsx'
    ]
  };

  public executeTask(gulp: gulpType.Gulp): NodeJS.ReadWriteStream {
    const taskScope: TSLintTask = this;

    if (this.taskConfig.lintConfig) {
      return gulp.src(this.taskConfig.sourceMatch)
        .pipe(through2.obj(function(
          file: gutil.File,
          encoding: string,
          callback: (encoding?: string, file?: gutil.File) => void): void {
          // Lint the file
          if (file.isNull()) {
            return callback(undefined, file);
          }

          // Stream is not supported
          if (file.isStream()) {
            this.emit('error', new gutil.PluginError(this.name, 'Streaming not supported'));
            return callback();
          }

          const options: lintTypes.ILinterOptions = {
            configuration: taskScope.taskConfig.lintConfig,
            formatter: 'json',
            formattersDirectory: undefined, // not used, use reporters instead
            rulesDirectory: taskScope.taskConfig.rulesDirectory || []
          };

          const tslintOutput: tslint = new tslint(file.relative, file.contents.toString('utf8'), options);
          /* tslint:disable:no-string-literal */
          const result: lintTypes.LintResult = file['tslint'] = tslintOutput.lint();
          /* tslint:enable:no-string-literal */

          if (result.failureCount > 0) {
            taskScope.taskConfig.reporter(result, file, taskScope.taskConfig);
          }

          this.push(file);
          callback();
        }));
    }
  }
}
