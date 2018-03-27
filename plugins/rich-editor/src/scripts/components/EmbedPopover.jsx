/**
 * @author Adam (charrondev) Charron <adam.c@vanillaforums.com>
 * @copyright 2009-2018 Vanilla Forums Inc.
 * @license https://opensource.org/licenses/GPL-2.0 GPL-2.0
 */

import React from "react";
import { t } from "@core/utility";
import * as PropTypes from "prop-types";
import QuillEmbedModule from "../QuillEmbedModule";
import { withEditor, editorContextTypes } from "./EditorProvider";
import InsertPopover from "./Popover";

export class EmbedPopover extends React.PureComponent {

    /** @type {QuillEmbedModule}*/
    embedModule;

    /**
     *
     */
    state = {
        url: "",
    };

    static propTypes = {
        ...editorContextTypes,
        isVisible: PropTypes.bool.isRequired,
        closeMenu: PropTypes.func.isRequired,
        blurHandler: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);
        this.embedModule = props.quill.getModule("embed");
    }

    clearInput() {
        this.setState({
            url: "",
        });
    }

    /**
     * Handle a submit button click.
     *
     * @param {React.SyntheticEvent} event - The button press event.
     */
    buttonClickHandler = (event) => {
        event.preventDefault();
        console.log("Click");
        this.clearInput();
        this.embedModule.scrapeMedia(this.state.url);
    };

    /**
     * Control the inputs value.
     *
     * @param {React.ChangeEvent} event - The change event.
     */
    inputChangeHandler = (event) => {
        this.setState({url: event.target.value});
    };

    render() {
        const title = t("Insert Media");
        const description = t("Insert an embedded web page, or video into your message.");

        const body = <React.Fragment>
            <p id="tempId-insertMediaMenu-p" className="insertMedia-description">
                {t('Paste the URL of the media you want.')}
            </p>
            <input className="InputBox" placeholder="http://" value={this.state.url} onChange={this.inputChangeHandler}/>
        </React.Fragment>;

        const footer = <React.Fragment>
            <a href="#" className="insertMedia-help" aria-label={t('Get Help on Inserting Media')}>
                {t('Help')}
            </a>

            <input
                type="button"
                className="Button Primary insertMedia-insert"
                value={('Insert')}
                aria-label={('Insert Media')}
                onBlur={this.props.blurHandler}
                onClick={this.buttonClickHandler}
            />
        </React.Fragment>;

        return <InsertPopover
            id={this.props.id}
            title={title}
            accessibleDescription={description}
            body={body}
            footer={footer}
            additionalClassRoot="insertMedia"
            closeMenu={this.props.closeMenu}
            isVisible={this.props.isVisible}
        />;
    }
}

export default withEditor(EmbedPopover);
