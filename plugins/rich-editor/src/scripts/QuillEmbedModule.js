/**
 * @author Adam (charrondev) Charron <adam.c@vanillaforums.com>
 * @copyright 2009-2018 Vanilla Forums Inc.
 * @license https://opensource.org/licenses/GPL-2.0 GPL-2.0
 */

// Quill
import Module from "quill/core/module";
import { closeEditorFlyouts } from "./quill-utilities";
import Parchment from "parchment";
import EmbedLoadingBlot from "./blots/EmbedLoadingBlot";
import FileUploader from "@core/FileUploader";
import { logError, t } from "@core/utility";
import Emitter from "quill/core/emitter";
import ajax from "@core/ajax";

/**
 * @typedef {Object} ScrapeResult
 * @property {any[]} attributes
 * @property {string} type
 * @property {string} url
 * @property {string} body
 * @property {string} name
 * @property {string} photoUrl
 * @property {number} height
 * @property {number} width
 */

/**
 * A Quill module for managing insertion of embeds/loading/error states.
 */
export default class QuillEmbedModule extends Module {

    /** @var {Quill} */
    quill;

    /** @var A File:Blot map. */
    currentUploads = new Map();

    /** @var {RangeStatic} */
    lastSelection = { index: 0, length: 0 };

    pauseSelectionTracking = false;

    constructor(quill, options = {}) {
        super(quill, options);
        this.quill = quill;
        this.setupImageUploads();
        this.setupSelectionListener();
    }

    /**
     * Initiate a media scrape, and insert the appropriate embed blots depending on response.
     *
     * @param {string} url - The URL to scrape.
     */
    scrapeMedia(url) {
        const formData = new FormData();
        formData.append("url", url);

        this.createLoadingEmbed(url);

        ajax.post("/media/scrape", formData)
            .then(result => {
                switch(result.data.type) {
                case "site":
                    this.createSiteEmbed(result.data);
                    break;
                case "image":
                    this.createExternalImageEmbed(result.data);
                    break;
                default:
                    this.createErrorEmbed(url, new Error(t("That type of embed is not currently supported.")));
                    break;
                }
            }).catch(error => {
                if (error.response && error.response.data && error.response.data.message) {
                    const message = error.response.data.message;

                    if (message.startsWith("Failed to load URL")) {
                        this.createErrorEmbed(url, new Error(t("There was an error processing that embed link.")));
                        return;
                    } else {
                        this.createErrorEmbed(url, new Error(message));
                        return;
                    }
                }

                this.createErrorEmbed(url, error);
            });
    }

    /**
     * Create a video embed.
     *
     * @param {ScrapeResult} scrapeResult
     */
    createVideoEmbed(scrapeResult) {

        const linkEmbed = Parchment.create("embed-video", scrapeResult);
        const completedBlot = this.currentUploads.get(scrapeResult.url);

        // The loading blot may have been undone/deleted since we created it.
        if (completedBlot) {
            completedBlot.replaceWith(linkEmbed);
        }

        this.currentUploads.delete(scrapeResult.url);
    }

    /**
     * Create a site embed.
     *
     * @param {ScrapeResult} scrapeResult
     */
    createSiteEmbed(scrapeResult) {
        const {
            url,
            photoUrl,
            name,
            body,
        } = scrapeResult;


        const linkEmbed = Parchment.create("embed-link",
            {
                url,
                name,
                linkImage: photoUrl,
                excerpt: body,
            }
        );
        const completedBlot = this.currentUploads.get(url);

        // The loading blot may have been undone/deleted since we created it.
        if (completedBlot) {
            completedBlot.replaceWith(linkEmbed);
        }

        this.currentUploads.delete(url);
    }

    createExternalImageEmbed(scrapeResult) {
        const {
            url,
            photoUrl,
            name,
        } = scrapeResult;


        const linkEmbed = Parchment.create("embed-image",
            {
                url: photoUrl,
                alt: name,
            }
        );
        const completedBlot = this.currentUploads.get(url);

        // The loading blot may have been undone/deleted since we created it.
        if (completedBlot) {
            completedBlot.replaceWith(linkEmbed);
        }

        this.currentUploads.delete(url);
    }

    /**
     * Transform an loading embed into an error embed.
     * @private
     *
     * @param {any} lookupKey - The lookup key for the loading embed.
     * @param {Error} error - The error thrown from the bad upload.
     */
    createErrorEmbed = (lookupKey, error) => {
        logError(error.message);

        if (lookupKey == null) {
            this.quill.insertEmbed(this.lastSelection.index, "embed-error", { errors: [error] }, Emitter.sources.USER);
            return;
        }

        const errorBlot = Parchment.create("embed-error", { errors: [error] }, Emitter.sources.USER);
        const loadingBlot = this.currentUploads.get(lookupKey);

        // The loading blot may have been undone/deleted since we created it.
        if (loadingBlot) {
            loadingBlot.replaceWith(errorBlot);
        }

        this.currentUploads.delete(lookupKey);
    };

    /**
     * Place an loading embed into the document and keep a reference to it.
     * @private
     *
     * @param {any} lookupKey - The lookup key for the loading embed.
     */
    createLoadingEmbed = (lookupKey) => {
        this.pauseSelectionTracking = true;
        this.quill.insertEmbed(this.lastSelection.index, "embed-loading", {}, Emitter.sources.USER);
        const [blot] = this.quill.scroll.descendant(EmbedLoadingBlot, this.lastSelection.index);

        this.quill.setSelection(this.lastSelection.index + 1);

        blot.registerDeleteCallback(() => {
            if (this.currentUploads.has(lookupKey)) {
                this.currentUploads.delete(lookupKey);
            }
        });

        this.currentUploads.set(lookupKey, blot);
        this.pauseSelectionTracking = false;
    };

    /**
     * Setup a selection listener for quill.
     * @private
     */
    setupSelectionListener() {
        this.quill.on(Emitter.events.EDITOR_CHANGE, this.handleEditorChange);
    }

    /**
     * Handle changes from the editor.
     * @private
     *
     * @param {string} type - The event type. See {quill/core/emitter}
     * @param {RangeStatic} range - The new range.
     */
    handleEditorChange = (type, range) => {
        if (range && !this.pauseSelectionTracking) {
            if (typeof range.index !== "number") {
                range = this.quill.getSelection();
            }

            if (range != null) {
                this.lastSelection = range;
            }
        }
    };

    /**
     * Setup image upload listeners and handlers.
     * @private
     */
    setupImageUploads() {
        this.fileUploader = new FileUploader(
            this.createLoadingEmbed,
            this.onImageUploadSuccess,
            this.createErrorEmbed,
        );

        this.quill.root.addEventListener('drop', this.fileUploader.dropHandler, false);
        this.quill.root.addEventListener('paste', this.fileUploader.pasteHandler, false);
        this.setupImageUploadButton();
    }

    /**
     * Handler for a successful image upload.
     * @private
     *
     * @param {File} file - The file being uploaded.
     * @param {Object} response - The axios response from the ajax request.
     */
    onImageUploadSuccess = (file, response) => {
        const imageEmbed = Parchment.create("embed-image", { url: response.data.url });
        const completedBlot = this.currentUploads.get(file);

        // The loading blot may have been undone/deleted since we created it.
        if (completedBlot) {
            completedBlot.replaceWith(imageEmbed);
        }

        this.currentUploads.delete(file);
    };

    /**
     * Setup the the fake file input for image uploads.
     * @private
     */
    setupImageUploadButton() {
        const fakeImageUpload = this.quill.container.closest(".richEditor").querySelector(".js-fakeFileUpload");
        const imageUpload = this.quill.container.closest(".richEditor").querySelector(".js-fileUpload");

        fakeImageUpload.addEventListener("click", () => {
            closeEditorFlyouts();
            imageUpload.click();
        });

        imageUpload.addEventListener("change", () => {
            const file = imageUpload.files[0];
            this.fileUploader.uploadFile(file);
        });
    }
}
