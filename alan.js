// Create chat connector for communicating with the Bot Framework Service
const crypto = require('crypto');
const alans = {}

const builder = require('botbuilder')
const restify = require('restify');

const Rx = require ('xregexp')
var rx = require ('./regexps')

function getAlan(session) {
    return Alan.from(session)
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

    static get alans() { return alans }

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
            alan.command = {name: "choose_", argument: '_choice'}
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



    async do(what) {
        this.push(what)
        let methodName = '_' + what
        await this[methodName]()
        this.pop()
    }

    switchTo(what) {
        this.do(what, {replace: true})
    }

    static isDialog(commandName) {
        return !(typeof Alan.commands[commandName] === 'function')
    }
    
    async go() {
        let alan = this

        alan.session.beginDialog('alan.daemon')
        
        while(1) {
            alan.item = alan.currentBranch().shift()
            alan.parseCommand()
            await alan.do(alan.command.name)
        }
    }

    async prompt(dialogType, optionsOrChoices, options) {
        return new Promise(async (resolve, reject) => {
            this.dialog.end = resolve

            let dialog = this.dialog

            dialog.type = dialogType
            dialog.options = optionsOrChoices
            
            if (dialogType == 'choice') {
                dialog.choices = optionsOrChoices
                dialog.options = options
            }

            await new Promise((resolve, reject) => {
                this.session.sendBatch(resolve)
            })

            dialog.prompt = this.messages.pop()

            this.dialog.start()
        })
    }

}

var rx = require('./regexps')

module.exports = Alan