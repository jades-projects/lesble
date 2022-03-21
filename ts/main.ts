import * as T from "./template.js";

const GUESSES = 6;
const COMMIT = "abb889b";

enum LetterColour {
    GREEN,
    YELLOW,
    BLACK,
    UNKNOWN,
}

enum GradeResult {
    CORRECT,
    NICE_TRY,
    INVALID,
}

const COLOUR_CLASSES = {
    [LetterColour.BLACK]: "letterBlack",
    [LetterColour.YELLOW]: "letterYellow",
    [LetterColour.GREEN]: "letterGreen",
    [LetterColour.UNKNOWN]: "",
};

const COLOUR_DESCS = {
    [LetterColour.BLACK]: "absent",
    [LetterColour.YELLOW]: "misplaced",
    [LetterColour.GREEN]: "correct",
    [LetterColour.UNKNOWN]: "",
};

const COLOUR_EMOJIS = {
    [LetterColour.BLACK]: "🖤",
    [LetterColour.YELLOW]: "💛",
    [LetterColour.GREEN]: "💚",
    [LetterColour.UNKNOWN]: "💣",
};

function todayOffset() {
    // jesus christ
    const RELEASE_DATE = new Date(2022, 0, 27);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.round((today.getTime() - RELEASE_DATE.getTime()) / 86400_000);
}

function letterToPos(letter: string) {
    return letter.charCodeAt(0) - "a".charCodeAt(0);
}

type SerializedGameState = {
    day: number;
    previousGuesses: [string, LetterColour[]][];
};

function loadGameState(expectDay: number): [string, LetterColour[]][] | null {
    const obj = window.localStorage.getItem("gameState");
    if (!obj) return null;
    const state = JSON.parse(obj);
    if (state.previousGuesses == null || state.day == null) return null;
    if (state.day !== expectDay) return null;

    return state.previousGuesses;
}

function isSuccess(result: LetterColour[]): boolean {
    for (const pos of result) {
        if (pos !== LetterColour.GREEN) {
            return false;
        }
    }
    return true;
}

class GameState {
    words: string[];
    day: number;
    correct: string;
    previousGuesses: [string, LetterColour[]][] = [];
    letterColours: LetterColour[] = Array(26).fill(LetterColour.UNKNOWN);

    constructor({ corrects, words }: WordData) {
        this.words = words;
        this.day = todayOffset();
        this.correct = corrects[this.day];
        if (this.correct == null) {
            throw new Error(`Don't have a word for day ${this.day}`);
        }
    }

    saveGameState() {
        const serialized: SerializedGameState = {
            day: this.day,
            previousGuesses: this.previousGuesses,
        };
        window.localStorage.setItem("gameState", JSON.stringify(serialized));
    }

    asString(): string {
        const success = isSuccess(
            this.previousGuesses[this.previousGuesses.length - 1][1]
        );
        const num = success ? this.previousGuesses.length.toString() : "❌";

        let out = "";
        out += `lesble.jade.fyi ${this.day}: ${num}/${GUESSES}\n`;
        out += this.previousGuesses
            .map(([_guess, line]) =>
                line.map((col) => COLOUR_EMOJIS[col]).join("")
            )
            .join("\n");
        return out;
    }

    grade(guess: string): [GradeResult, LetterColour[]] {
        // O(n) with n = 100000, kinda a crime. TODO: binary search
        if (!this.words.includes(guess)) {
            return [GradeResult.INVALID, []];
        }

        let letterFreqs = Array(26).fill(0);
        let result = Array(this.correct.length).fill(LetterColour.BLACK);

        // first, take out the greens
        for (let i = 0; i < this.correct.length; ++i) {
            if (guess[i] === this.correct[i]) {
                result[i] = LetterColour.GREEN;
            } else {
                letterFreqs[letterToPos(this.correct[i])] += 1;
            }
        }

        // then take out the yellows
        for (let i = 0; i < this.correct.length; ++i) {
            if (result[i] === LetterColour.GREEN) {
                continue;
            }

            const letterPos = letterToPos(guess[i]);
            if (letterFreqs[letterPos] > 0) {
                letterFreqs[letterPos]--;
                result[i] = LetterColour.YELLOW;
            }
        }

        this.previousGuesses.push([guess, result]);
        for (const [col, ltr] of zip(result, Array.from(guess))) {
            const pos = letterToPos(ltr);
            if (col < this.letterColours[pos]) {
                this.letterColours[pos] = col;
            }
        }

        return [
            isSuccess(result) ? GradeResult.CORRECT : GradeResult.NICE_TRY,
            result,
        ];
    }
}

function* zip<A, B>(a: Array<A>, b: Array<B>): Generator<[A, B]> {
    // NOTE: works badly if you change the length of a collection.
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        yield [a[i], b[i]];
    }
}

type Grader = (guess: string) => [GradeResult, LetterColour[]];

interface ConstructInputManager {
    grade: Grader;
    getLetterColours: () => LetterColour[];
    getShareString: () => string;
    getCorrectWord: () => string;
    notifyEl: HTMLElement;
    rows: Element[];
    keyboardRows: Element[];
}

class InputManager {
    constructor({
        grade,
        getLetterColours,
        getShareString,
        getCorrectWord,
        notifyEl,
        rows,
        keyboardRows,
    }: ConstructInputManager) {
        this.grade = grade;
        this.getLetterColours = getLetterColours;
        this.getShareString = getShareString;
        this.getCorrectWord = getCorrectWord;
        this.notifyEl = notifyEl;
        this.rows = rows;
        this.keyboardRows = keyboardRows;
    }

    acceptingInput: boolean = true;
    notifyEl: HTMLElement;
    rows: Element[];
    keyboardRows: Element[];
    getLetterColours: () => LetterColour[];
    getCorrectWord: () => string;
    getShareString: () => string;
    onAccept: () => void = () => {};
    rowIdx: number = 0;

    get row() {
        return this.rows[this.rowIdx];
    }
    get lineLength(): number {
        return this.row.children.length;
    }

    currentGuess: string = "";
    grade: Grader;

    updateColours(colours: LetterColour[], guess: string) {
        // this.row.setAttribute("aria-label", guess);

        for (const [el, col] of zip(Array.from(this.row.children), colours)) {
            el.className = COLOUR_CLASSES[col];
            el.setAttribute(
                "aria-label",
                `${el.textContent}, ${COLOUR_DESCS[col]}`
            );
        }

        const findKey = (ltr: string) => {
            for (const row of this.keyboardRows) {
                for (const key of row.children) {
                    if (key.textContent!.trim() === ltr) {
                        return key;
                    }
                }
            }
            throw new Error("unknown letter " + ltr);
        };

        for (let i = 0; i < 26; ++i) {
            const ltr = String.fromCharCode("a".charCodeAt(0) + i);
            const key = findKey(ltr);
            const letterColour = this.getLetterColours()[i];
            key.className = COLOUR_CLASSES[letterColour];

            if (letterColour !== LetterColour.UNKNOWN) {
                key.setAttribute(
                    "aria-label",
                    `${key.textContent}, ${COLOUR_DESCS[letterColour]}`
                );
            }
        }
    }

    updateRow(guess: string) {
        for (let i = 0; i < this.lineLength; ++i) {
            this.row.children[i].textContent = guess.charAt(i);
        }
    }

    notify(subtree: Node) {
        this.notifyEl.innerHTML = "";
        this.notifyEl.appendChild(subtree);
    }

    addCopyResults() {
        const button = T.Button("Copy results").renderIntoNew();
        button.addEventListener("click", () => {
            navigator.clipboard.writeText(this.getShareString());
        });
        const box = T.Div(
            { className: "horizRow" },
            T.Div("The correct word is ", T.B(this.getCorrectWord())),
            button
        );
        this.notify(box.renderIntoNew());
    }

    applyGuess(guess: string) {
        // short line
        if (guess.length !== this.lineLength) {
            return;
        }

        this.updateRow(guess);

        const [result, colours] = this.grade(guess);

        // clear the message
        this.notify(T.Div().renderIntoNew());

        // accepted as valid word
        switch (result) {
            case GradeResult.NICE_TRY: {
                this.updateColours(colours, guess);
                this.onAccept();
                if (this.rowIdx === GUESSES - 1) {
                    this.acceptingInput = false;
                    this.addCopyResults();
                    break;
                }
                this.rowIdx++;
                break;
            }

            case GradeResult.CORRECT: {
                this.updateColours(colours, guess);
                this.acceptingInput = false;
                this.onAccept();
                this.addCopyResults();
                break;
            }

            case GradeResult.INVALID: {
                this.notify(
                    T.Div(
                        T.B(guess),
                        " is not in the word list"
                    ).renderIntoNew()
                );
                break;
            }
        }
        return result;
    }

    onInput(key: string) {
        if (!this.acceptingInput) return;
        if (key === "enter") {
            if (this.applyGuess(this.currentGuess) === GradeResult.NICE_TRY) {
                this.currentGuess = "";
            }
        } else if (key === "delete") {
            this.currentGuess = this.currentGuess.slice(0, -1);
            this.updateRow(this.currentGuess);
        } else {
            if (this.currentGuess.length >= this.lineLength) {
                return;
            } else {
                this.currentGuess += key;
                this.updateRow(this.currentGuess);
            }
        }
    }
}

function registerKeyboard(keyboardEl: HTMLElement, cb: (key: string) => void) {
    for (const row of keyboardEl!.children) {
        for (const key of row.children) {
            const keyName = key.textContent!.trim();
            key.addEventListener("click", () => cb(keyName));
        }
    }

    document.body.addEventListener("keydown", (ev) => {
        const LETTERS = Array.from("abcdefghijklmnopqrstuvwxyz");
        if (LETTERS.includes(ev.key)) {
            console.log(ev.key);
            cb(ev.key);
        } else if (ev.key === "Backspace") {
            cb("delete");
        } else if (ev.key === "Enter") {
            cb("enter");
        }
    });
}

type WordData = {
    words: string[];
    corrects: string[];
};

async function fetchWords(): Promise<WordData> {
    const fetchList = async (path: string) => {
        const resp = await fetch(path);
        if (!resp.ok) {
            throw new Error(`Failed while grabbing resource: ${path}`);
        }
        return (await resp.text()).split("\n").filter((s) => s !== "");
    };
    const [words, corrects] = await Promise.all([
        fetchList("words"),
        fetchList("corrects"),
    ]);
    return { words, corrects };
}

function setupGrid(grid: HTMLElement, n: number) {
    for (const row of grid.children) {
        for (let i = 0; i < n; ++i) {
            const el = document.createElement("div");
            row.appendChild(el);
        }
    }
}

function setupDebugData(el: HTMLElement, state: GameState) {
    const commit = COMMIT.startsWith("@") ? "dev" : COMMIT;
    T.Div(`${commit} #${state.day}`).render(el);
}

var gameState: GameState;
var inputManager: InputManager;

window.addEventListener("load", async () => {
    // FIXME: load the words in the background while the user types
    const notifyEl = document.getElementById("messages");
    const debugEl = document.getElementById("debug-data");
    try {
        const wordData = await fetchWords();
        gameState = new GameState(wordData);
        setupDebugData(debugEl!, gameState);
    } catch (err) {
        T.Div(`Initialization error: ${err}`).render(notifyEl!);
        throw err;
    }
    const rows = document.getElementById("grid");
    setupGrid(rows!, gameState.correct.length);

    const keyboardEl = document.getElementById("keyboard");
    inputManager = new InputManager({
        grade: (g) => gameState.grade(g),
        getLetterColours: () => gameState.letterColours,
        getShareString: () => gameState.asString(),
        getCorrectWord: () => gameState.correct,
        notifyEl: notifyEl!,
        rows: Array.from(rows!.children),
        keyboardRows: Array.from(keyboardEl!.children),
    });

    const savedState = loadGameState(gameState.day);
    if (savedState) {
        for (const [guess, _result] of savedState) {
            inputManager.applyGuess(guess);
        }
    }

    inputManager.onAccept = () => gameState.saveGameState();

    registerKeyboard(keyboardEl!, (k) => inputManager.onInput(k));
});
