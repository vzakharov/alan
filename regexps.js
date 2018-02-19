const Rx = require ('xregexp')

const varNamePtrn = "[a-z_][a-zA-Z0-9_.]*[a-zA-Z0-9_]" // RegExp pattern to be used for identifying variable names
//const fullVariableRegExp = new RegExp("^" + varNamePtrn + "$", 'g')
//const inlineVariableRegExp = new RegExp("@" + varNamePtrn, 'g')

const defArgPtrn = Rx(`(?<what>${varNamePtrn})$`)

module.exports = {
    setToWhat: /^(to|=)$/,
    number: /^[0-9.]+$/,
    command: /^([a-z][a-zA-Z.]+) (.+)$/,
    inlineVar: new RegExp("@" + varNamePtrn, 'g'),
    fullVar: new RegExp("^" + varNamePtrn + "$", 'g'),
    args: {
        choose: {
            among: defArgPtrn,
            need: defArgPtrn
        },
        set: Rx(`(?<what> ${varNamePtrn} )                  # variable name
            (
                (?<boolean> $)                          |   # no argument (set to 1/true)
                (   [ ]
                    (?<toNextItem> (to|=|>>)$ )         |   # to the next item in the alan feed
                    (?<number> [0-9.]+$)                |   # to a number 
                    (?<var> @${varNamePtrn}$)           |   # to another variable’s value
                    (?<value> .*)                           # to anything else
                    $
                )
            )`, 'x')
    }
}