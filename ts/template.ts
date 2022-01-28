/**
 * Accepts four types of thing as params:
 * - String; will emit text in position.
 * - DomElement; will render recursively in position
 * - HTMLElement; will append in position
 * - Arbitrary object, which will be assigned as properties to the element
 *   being rendered.
 *
 * Example usage:
 * const dom = Div({ id: 'blah' },
 *     P('Text content'),
 *     someDomSubtree
 * ).render()
 */

type PropertySet = { [key: string]: any };
type DomInput = DomElement | string | PropertySet;
export class DomElement {
    children: DomInput[];
    type: string;
    constructor(type: string, ...params: DomInput[]) {
        const children = [];
        for (const param of params) {
            children.push(param);
        }

        this.children = children;
        this.type = type;
    }

    /**
     * Renders the tree, appending it into the given element
     */
    render(intoDom: HTMLElement, append = true) {
        const myElement = document.createElement(this.type);
        if (append) {
            intoDom.append(myElement);
        } else {
            intoDom.prepend(myElement);
        }

        for (const child of this.children) {
            if (child instanceof DomElement) {
                child.render(myElement);
            } else if (
                child instanceof HTMLElement ||
                typeof child === "string"
            ) {
                // can directly put a html element tree or string in
                myElement.append(child);
            } else {
                // it's probably properties we should apply to ourself
                console.assert(typeof child === "object");

                // classList does not work as one might expect; if you assign
                // it, it will just toString the array (!!). Instead, we
                // rewrite it as className.
                const { classList } = child;
                delete child.classList;
                Object.assign(myElement, child);
                if (classList) {
                    myElement.className = classList.join(" ");
                }
            }
        }
    }

    /**
     * Renders into a new element and returns the resulting HTMLElement
     * containing the tree.
     */
    renderIntoNew(): ChildNode {
        const e = document.createElement("template");
        this.render(e);
        return e.firstChild!;
    }
}

const makeDomElement = (elType: string) => {
    return (...params: DomInput[]) => new DomElement(elType, ...params);
};

export const Div = makeDomElement('div');
export const Button = makeDomElement('button');
export const B = makeDomElement('b');
