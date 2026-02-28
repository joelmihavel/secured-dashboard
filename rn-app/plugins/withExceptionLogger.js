const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that injects an ObjC file to intercept ALL ObjC exceptions
 * using objc_setExceptionPreprocessor() — the official runtime API.
 *
 * This catches every @throw (not just [NSException raise]), works on physical
 * iOS devices, and logs to both os_log and a file in the app's tmp directory.
 *
 * TEMPORARY: Remove once the crashing TurboModule is identified.
 */

const OBJC_FILE_NAME = "FlentExceptionLogger.m";

const OBJC_CONTENTS = `
#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <objc/objc-exception.h>
#import <os/log.h>

// FlentExceptionLogger v4 — objc_setExceptionPreprocessor
// Intercepts ALL ObjC exceptions (both @throw and [NSException raise])
// Writes to os_log (fault level, %{public}s) AND file in tmp dir.

static os_log_t exceptionLog = NULL;
static NSString *logFilePath = nil;
static int exceptionCount = 0;
static objc_exception_preprocessor previousPreprocessor = NULL;

static void writeToLogFile(NSString *message) {
    if (!logFilePath) return;
    NSString *line = [NSString stringWithFormat:@"[%d] %@\\n", exceptionCount, message];
    NSFileHandle *fh = [NSFileHandle fileHandleForWritingAtPath:logFilePath];
    if (fh) {
        [fh seekToEndOfFile];
        [fh writeData:[line dataUsingEncoding:NSUTF8StringEncoding]];
        [fh synchronizeFile];
        [fh closeFile];
    }
}

static id flent_exception_preprocessor(id exception) {
    exceptionCount++;
    if (!exceptionLog) {
        exceptionLog = os_log_create("com.flent.secured.exceptions", "throw");
    }
    if ([exception isKindOfClass:[NSException class]]) {
        NSException *nsException = (NSException *)exception;
        const char *className = [NSStringFromClass([exception class]) UTF8String] ?: "(null)";
        const char *name = [nsException.name UTF8String] ?: "(null)";
        const char *reason = [nsException.reason UTF8String] ?: "(null)";
        os_log_fault(exceptionLog,
                     "EXCEPTION #%d THROWN - class:%{public}s name:%{public}s reason:%{public}s",
                     exceptionCount, className, name, reason);
        writeToLogFile([NSString stringWithFormat:@"EXCEPTION class=%@ name=%@ reason=%@",
                        NSStringFromClass([exception class]),
                        nsException.name ?: @"(null)",
                        nsException.reason ?: @"(null)"]);
        if (nsException.userInfo.count > 0) {
            NSString *userInfoStr = [NSString stringWithFormat:@"%@", nsException.userInfo];
            os_log_fault(exceptionLog, "  userInfo:%{public}s",
                         [userInfoStr UTF8String] ?: "(null)");
            writeToLogFile([NSString stringWithFormat:@"  userInfo=%@", userInfoStr]);
        }
        NSArray *stack = [nsException callStackSymbols];
        if (!stack || stack.count == 0) {
            stack = [NSThread callStackSymbols];
            writeToLogFile(@"  (using current thread stack, exception had no callStackSymbols)");
        }
        NSInteger count = MIN(stack.count, 20);
        for (NSInteger i = 0; i < count; i++) {
            os_log_fault(exceptionLog, "  frame[%ld]: %{public}s",
                         (long)i, [stack[i] UTF8String]);
            writeToLogFile([NSString stringWithFormat:@"  frame[%ld]: %@", (long)i, stack[i]]);
        }
        const char *queueLabel = dispatch_queue_get_label(DISPATCH_CURRENT_QUEUE_LABEL) ?: "(null)";
        os_log_fault(exceptionLog,
                     "  thread:%{public}s isMain:%d queue:%{public}s",
                     [[NSThread currentThread].name UTF8String] ?: "(unnamed)",
                     [NSThread isMainThread],
                     queueLabel);
        writeToLogFile([NSString stringWithFormat:@"  thread=%@ isMain=%d queue=%s",
                        [NSThread currentThread].name ?: @"(unnamed)",
                        [NSThread isMainThread],
                        queueLabel]);
    } else {
        const char *className = [NSStringFromClass([exception class]) UTF8String] ?: "(unknown)";
        os_log_fault(exceptionLog,
                     "NON-NSException #%d THROWN - class:%{public}s description:%{public}s",
                     exceptionCount, className,
                     [[exception description] UTF8String] ?: "(null)");
        writeToLogFile([NSString stringWithFormat:@"NON-NSException class=%@ description=%@",
                        NSStringFromClass([exception class]) ?: @"(unknown)",
                        [exception description] ?: @"(null)"]);
    }
    if (previousPreprocessor) {
        return previousPreprocessor(exception);
    }
    return exception;
}

static NSUncaughtExceptionHandler *previousUncaughtHandler = NULL;

static void flent_uncaught_exception_handler(NSException *exception) {
    os_log_fault(exceptionLog,
                 "UNCAUGHT EXCEPTION - name:%{public}s reason:%{public}s",
                 [exception.name UTF8String] ?: "(null)",
                 [exception.reason UTF8String] ?: "(null)");
    writeToLogFile([NSString stringWithFormat:@"UNCAUGHT name=%@ reason=%@",
                    exception.name ?: @"(null)",
                    exception.reason ?: @"(null)"]);
    NSArray *stack = [exception callStackSymbols];
    NSInteger count = MIN(stack.count, 30);
    for (NSInteger i = 0; i < count; i++) {
        writeToLogFile([NSString stringWithFormat:@"  uncaught-frame[%ld]: %@", (long)i, stack[i]]);
    }
    if (previousUncaughtHandler) {
        previousUncaughtHandler(exception);
    }
}

__attribute__((constructor))
static void installExceptionLogger(void) {
    exceptionLog = os_log_create("com.flent.secured.exceptions", "throw");
    NSString *tmpDir = NSTemporaryDirectory();
    logFilePath = [tmpDir stringByAppendingPathComponent:@"FlentExceptionLog.txt"];
    [@"=== FlentExceptionLogger v4 (objc_setExceptionPreprocessor) started ===\\n"
        writeToFile:logFilePath atomically:YES encoding:NSUTF8StringEncoding error:nil];
    previousPreprocessor = objc_setExceptionPreprocessor(flent_exception_preprocessor);
    if (previousPreprocessor) {
        os_log_fault(exceptionLog,
                     "Installed preprocessor (chained to previous at %p)",
                     (void *)previousPreprocessor);
        writeToLogFile([NSString stringWithFormat:@"Installed preprocessor (chained to previous at %p)",
                        (void *)previousPreprocessor]);
    } else {
        os_log_fault(exceptionLog, "Installed preprocessor (no previous)");
        writeToLogFile(@"Installed preprocessor (no previous)");
    }
    previousUncaughtHandler = NSGetUncaughtExceptionHandler();
    NSSetUncaughtExceptionHandler(flent_uncaught_exception_handler);
    os_log_fault(exceptionLog,
                 "Exception interceptor v4 installed, log: %{public}s",
                 [logFilePath UTF8String]);
    writeToLogFile(@"Setup complete. Monitoring all @throw exceptions.");
}
`;

function withExceptionLoggerFile(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const filePath = path.join(projectRoot, "FlentSecured", OBJC_FILE_NAME);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, OBJC_CONTENTS);
      console.log(`[withExceptionLogger] Wrote ${filePath}`);
      return config;
    },
  ]);
}

function withExceptionLoggerXcode(config) {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;

    // Find the main group key for "FlentSecured"
    const mainGroupKey = proj.findPBXGroupKey({ name: "FlentSecured" });
    if (!mainGroupKey) {
      console.warn(`[withExceptionLogger] Could not find FlentSecured group, skipping`);
      return config;
    }

    // Add the source file to the FlentSecured group
    proj.addSourceFile(OBJC_FILE_NAME, {}, mainGroupKey);
    console.log(`[withExceptionLogger] Added ${OBJC_FILE_NAME} to Xcode project`);

    return config;
  });
}

function withExceptionLogger(config) {
  config = withExceptionLoggerFile(config);
  config = withExceptionLoggerXcode(config);
  return config;
}

module.exports = withExceptionLogger;
