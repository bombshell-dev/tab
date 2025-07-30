type OptionsMap = Map<string, Option>

type Complete = (value: string, description: string) => void

type OptionCompleter = (this: Option, complete: Complete, options: OptionsMap) => void

class Option {
    value: string
    description: string
    command: Command
    completer?: OptionCompleter
    shortValue?: string
    // TODO: handle boolean options

    constructor(command: Command, value: string, description: string, completer?: OptionCompleter, shortValue?: string) {
        this.command = command
        this.value = value
        this.description = description
        this.completer = completer
        this.shortValue = shortValue
    }
}

type CommandCompleter = (this: Command, complete: Complete, options: OptionsMap) => void

class Command {
    value: string
    description: string

    options = new Map<string, Option>
    

    completer?: CommandCompleter

    constructor(value: string, description: string, completer?: CommandCompleter) {
        this.value = value
        this.description = description
        this.completer = completer
    }

    option(value: string, description: string, completer?: OptionCompleter, shortValue?: string) {
        this.options.set(value, new Option(this, value, description, completer, shortValue))
        return this
    }



}

import * as zsh from './zsh';
import * as bash from './bash';
import * as fish from './fish';
import * as powershell from './powershell';
import assert from 'node:assert'

class RootCommand extends Command {
    completer = undefined
    commands = new Map<string, Command>

    constructor() {
        super('', '')
    }

    command(value: string, description: string, completer?: CommandCompleter) {
        const c = new Command(value, description, completer)
        this.commands.set(value, c)
        return c
    }

    parse(args: string[]) {
        const endsWithSpace = args[args.length - 1] === ''

        if (endsWithSpace) {
            args.pop()
        }

        const toComplete = args[args.length - 1] || ''
        const previousArgs = args.slice(0, -1)
        
        for (const arg of previousArgs) {
            const option = this.options.get(arg)
        }
    }

    setup(name: string, executable: string, shell: string) {
        assert(shell === 'zsh' || shell === 'bash' || shell === 'fish' || shell === 'powershell', 'Unsupported shell')

        switch (shell) {
            case 'zsh': {
                const script = zsh.generate(name, executable);
                console.log(script);
                break;
            }
            case 'bash': {
                const script = bash.generate(name, executable);
                console.log(script);
                break;
            }
            case 'fish': {
                const script = fish.generate(name, executable);
                console.log(script);
                break;
            }
            case 'powershell': {
                const script = powershell.generate(name, executable);
                console.log(script);
                break;
            }
        }
    }
}

const t = new RootCommand()

export default t

// import t from '@bombsh/tab'

t.option('help', 'list available commands') // Command (Root) 

t
    .command('start', 'start the development server') // Command ('start')
    .option('port', 'specify the port number', function (complete, options) {
        complete('3000', 'general port')
        complete('3001', 'another general port')
        complete('3002', 'another general port')
    }) // Command ('port')

t
    .command('start dev', 'start the development server') // Command ('start')


const x = 'npx my-cli'

// t.setup('my-cli', x, process.argv[2])
console.log(process.argv)

t.parse(process.argv.slice(3))