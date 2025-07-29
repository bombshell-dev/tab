class Option {
    name: string

    constructor(name: string) {
        this.name = name
    }
}

class Command {
    root: boolean

    #name: string = ''

    options = new Map<string, Option>
    commands = new Map<string, Command>

    constructor(root: boolean) {
        this.root = root
    }

    name(name: string) {
        this.#name = name
    }

    option() {

    }

    command() {

    }

    parse() {

    }

    setup() {

    }
}

const t = new Command(true)

export default t

// import t from '@bombsh/tab'

t.option('help', 'list available commands') // Command (Root) 

t.command('start', 'start the development server') // Command ('start')
 .option('port', 'specify the port number') // Command ('port')

t.parse(process.argv.slice(3)) 

t.setup(process.argv[2], x)