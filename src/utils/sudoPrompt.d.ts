declare namespace sudo {
    interface ExecOptions {
        name?: string;
        icns?: string;
        env?: Record<string, string>;
    }

    function exec(
        command: string,
        options?: ExecOptions,
        callback?: (
            error?: Error,
            stdout?: string | Buffer,
            stderr?: string | Buffer,
        ) => void,
    ): void;
}

export default sudo;
