/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2016. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/

import React from "react";
import PropTypes from "prop-types";
import CodeMirror from "react-codemirror";
import cm from "codemirror";
import EditorControl from "./editor-control.jsx";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/display/placeholder";

import "codemirror/mode/javascript/javascript";
import "codemirror/addon/hint/javascript-hint";
import "codemirror/addon/hint/sql-hint";
import "codemirror/mode/sql/sql";
import "../util/CLEM";
import "../util/CLEM-hint";

const pxPerChar = 8.5;
const pxPerLine = 26;
const defaultCharPerLine = 30;
const maxLineHeight = 15 * pxPerLine; // 20 lines
const minLineHeight = 4 * pxPerLine; // 4 lines


export default class ExpressionControl extends EditorControl {
	constructor(props) {
		super(props);

		this.origHint = "";

		this.handleChange = this.handleChange.bind(this);

		this.addonHints = this.addonHints.bind(this);
		this.getDatasetFields = this.getDatasetFields.bind(this);
	}

	// Save original autocomplete handler and then register our custom handler
	// that will add data set filed names to autocomplete list.
	componentDidMount() {
		const codeMirrorInstance = this.codeMirror.getCodeMirror();
		this.origHint = codeMirrorInstance.getHelper({ line: 0, ch: 0 }, "hint");
		// this next line is a hack to overcome a Codemirror problem.  To support SparkSQL, a subset of SQL,
		// we need to register with Codemirror the language as the value of "text/x-hive". When Codemirror
		// registers the autocomplete addon it registers is as "sql" not the subset "text/x-hive"
		// This hack allows use to capture the "sql" autocomplete handler and subsitute our custom handler
		const language = (this.props.control.language === "text/x-hive") ? "sql" : this.props.control.language;
		cm.registerHelper("hint", language, this.addonHints);

		// set the default height, should be between 4 and 20 lines
		const editorDiv = document.getElementById("ExpressionEditor");
		const controlWidth = (editorDiv) ? editorDiv.clientWidth : 0;
		const charPerLine = (controlWidth > 0) ? controlWidth / pxPerChar : defaultCharPerLine;
		const height = (this.props.control.charLimit)
			? Math.min((this.props.control.charLimit / charPerLine) * pxPerLine, maxLineHeight) : minLineHeight;
		codeMirrorInstance.setSize(null, Math.max(Math.floor(height), minLineHeight));
	}

	// reset to the original autocomplete handler
	componentWillUnmount() {
		if (this.origHint) {
			cm.registerHelper("hint", this.props.control.language, this.origHint);
		}
	}

	// Add the dataset field names to the autocomplete list
	addonHints(editor, options) {
		var results = {};
		var cur = editor.getCursor();
		var token = editor.getTokenAt(cur);
		if (this.origHint) {
			// get the list of autocomplete names from the language autocomplete handler
			results = this.origHint(editor, options);

			// add to the start of the autocomplete list the set of dataset field names that complete the
			// string that has been entered.
			var parameters = this.getDatasetFields();
			for (var i = 0; i < parameters.length; ++i) {
				const parameter = parameters[i];
				if (parameter.lastIndexOf(token.string, 0) === 0 && results.list.indexOf(parameter) === -1) {
					results.list.unshift(parameter);
				} else if (token.string === " " && token.type === null) {
					results.list.unshift(parameter);
				}
			}
		}
		return results;
	}

	// get the set of dataset field names
	getDatasetFields() {
		var results = [];
		const dataModel = this.props.controller.getDatasetMetadata();
		if (dataModel) {
			for (var i = 0; i < dataModel.fields.length; ++i) {
				results.push(dataModel.fields[i].name);
			}
		}
		return results;
	}

	handleChange(value) {
		this.props.controller.updatePropertyValue(this.props.propertyId, value);
	}

	render() {
		var controlValue = this.props.controller.getPropertyValue(this.props.propertyId);
		const conditionProps = {
			propertyId: this.props.propertyId,
			controlType: "textfieldbox"
		};
		const conditionState = this.getConditionMsgState(conditionProps);

		const errorMessage = conditionState.message;
		var messageType = conditionState.messageType;
		const icon = conditionState.icon;
		const stateDisabled = conditionState.disabled;
		const stateStyle = conditionState.style;

		let controlIconContainerClass = "control-icon-container";
		if (messageType !== "info") {
			controlIconContainerClass = "control-icon-container-enabled";
		}

		messageType = (stateDisabled.disabled) ? "disabled" : messageType;

		const mirrorOptions = {
			mode: this.props.control.language,
			placeholder: this.props.control.additionalText,
			theme: messageType + " default",
			readOnly: (stateDisabled.disabled) ? "nocursor" : false,
			extraKeys: { "Ctrl-Space": "autocomplete" }
		};

		return (
			<div>
				<div className="editor_control_area" style={stateStyle}>
					<div id={controlIconContainerClass}>
						<div id="ExpressionEditor" >
							<CodeMirror
								ref= { (ref) => (this.codeMirror = ref)}
								options={mirrorOptions}
								onChange={this.handleChange}
								value={controlValue}
							/>
						</div>
						{icon}
					</div>
				</div>
				<div className="expression-validation-message">
					{errorMessage}
				</div>
			</div>
		);
	}
}

ExpressionControl.propTypes = {
	control: PropTypes.object.isRequired,
	propertyId: PropTypes.object.isRequired,
	controller: PropTypes.object.isRequired
};
