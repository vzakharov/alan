var bot
const crypto = require('crypto');
const alans = {}

//const builder = require('botbuilder')

const Rx = require ('xregexp')
var rx = require ('./regexps')

function getAlan(session) {
    return Alan.from(session)
}

function prepare(code, branch = []) {
    let labels = Alan.labels

    for (var i = 0; i < code.length; i++) {
        item = code[i]
        pos = branch.concat(i)
        if (Array.isArray(item)) {
            prepare(item, pos)
        } else if (typeof item == "string" && item[0] == "#") {
            labels[item.substring(1)] = pos
        }
    }
}

class Alan {      

    constructor(session) {

        this.uid = crypto.randomBytes(16).toString('hex')

        alans[this.uid] = this
        session.userData.alan = this

        Object.assign(this, Alan.default)

        Object.defineProperty(this, "session", {
            get: () => { return session }
        })

    }

    go() {
        this.session.beginDialog('alan.step')
    }


    // "Unfolds" a string including inline variables, etc.
    formatString(str) {
        let alan = this

        let variables = str.match(rx.inlineVar)
        if (variables) {
            variables.forEach((inlineVarName) => {
                let varValue = alan.getVar(inlineVarName.slice(1))
                str = str.replace(new RegExp(inlineVarName, 'g'), varValue)
            })                
        }
        return str
    }

    parseCommand() {
        let item = this.item
        let alan = this

        if (Array.isArray(item)) {
            alan.command = {name: "choose.go", argument: Alan.default.choice.var}
        } else if (typeof item == "number") {
            alan.command = {name: "goto", argument: item.toString()}
        } else if (item[0] == "#") {
            alan.command = {name: "next", argument: null}
        } else if (item.substring(0,2) == ">>") {
            alan.command = {name: "goto", argument: item.substring(2)}
        } else {
            let match = item.match(rx.command)
            if (match) {
                alan.command = {name: match[1], argument: match[2]}
            } else {
                alan.command = {name: "print", argument: item}
            }    
        }
    }

    getVar(varName) {
        let alan = this
        let location = alan.getVarLocation(varName)
        return location.branch[location.leaf]
    }

    setVar(varName, varValue) {
        let alan = this
        let location = alan.getVarLocation(varName)
        location.branch[location.leaf] = varValue
    }

    getVarLocation(varName) {
        let alan = this
        let children = varName.split('.')
        let varBranch = alan.vars
        while (children.length > 1) {
            let item = children.shift()
            if (!(item in varBranch)) {
                varBranch[item] = {}
            }
            varBranch = varBranch[item]                
        }
        return {branch:varBranch, leaf:children}
    }

    static get default() {
        return {
            vars: {},
            choice: {},
            dialog: {},
            branches: [Alan.code.slice()],
            command: {name: "", argument: null, results: null},
            commandStack: [],
            item: "",
            messages: [],
            context: "",
            choice: {
                branches: {},
                options: [],
                var: '_choice',
                operator: null,
                expectsCode: false,
                item: "",
                feed: []
            }      
        }
    }

    static from(session) {
        return alans[session.userData.alan.uid]
    }

    currentBranch() {
        let alan = this
        let branch = alan.branches[0]

        if (branch.length == 0) {
            alan.branches.shift()
            if (alan.branches.length == 0) {
                alan.branches = [Alan.code.slice()]
            }
        }

        return branch
    }

    wait() {
        this.push('_wait')
    }

    get mustWait() {
        return (this.lastStacked == '_wait')
    }

    get isStepOpen() {
        return (typeof this.lastStacked == 'number')
    }

    push(what) {
        let stack = this.commandStack
        stack.push(what)
        console.log(">> " + stack.join(" >> "))
    }

    pop() {
        let stack = this.commandStack
        stack.pop()
        console.log(stack.join(" >> ") + " <<")
    }

    get lastStacked() {
        let stack = this.commandStack
        return stack[stack.length - 1]
    }

    async do(what, options = {}) {
        let command = Alan.commands[what]
        let session = this.session

        this.push(what)
        if (Alan.isDialog(what)) {
            let dialogName = 'alan.' + what
            if (options.replace) {
                this.pop()
                session.replaceDialog(dialogName)
            } else {
                session.beginDialog(dialogName)
            }
        } else {
            await command(this)
            this.pop()
        }
    }

    switchTo(what) {
        this.do(what, {replace: true})
    }

    static isDialog(commandName) {
        return !(typeof Alan.commands[commandName] === 'function')
    }

}

var rx = require('./regexps')

Alan.addCommands = function(commands, path) {
    for (var what in commands) {
        let item = commands[what]
        if (typeof item === 'function') {
            continue
        } else {
            bot.dialog('alan.' + what, item)
        }
    }
}

Alan.init = function(code, initBot) {
    bot = initBot
    Alan.code = code

    Alan.labels = {}

    prepare(code)

    Alan.addCommands(Alan.commands)

    /*bot.dialog('alan.step', [async (session, args, next) => {
        let alan = getAlan(session)
        let branch = alan.branches[0]
    
        alan.item = branch.shift()
        let item = alan.item
        console.log("Code: ", item)
        alan.parseCommand()
        let commandName = alan.command.name
    
        await alan.do(commandName)
        next()
    }, (session) => {
        let alan = getAlan(session)
        let branch = alan.branches[0]
    
        if (branch.length == 0) {
            alan.branches.shift()
            if (alan.branches.length == 0) {
                alan.branches = [Alan.code.slice()]
            }
        }
    
        session.replaceDialog('alan.step')
    }])*/
}


module.exports = Alan