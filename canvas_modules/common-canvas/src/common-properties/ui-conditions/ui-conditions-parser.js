/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2017. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/

/* eslint complexity: ["error", 30]*/

import logger from "../../../utils/logger";
import { ItemType } from "../constants/form-constants";


function parseInput(definition) {
	var data = definition;
	if (data.evaluate) {
		var paramsList = [];
		evaluate(data.evaluate, paramsList, data.parameter_ref);
		// remove duplicates in paramsList array
		var uniqueList = Array.from(new Set(paramsList));
		if (uniqueList.length > 1) {
			return uniqueList;
		}
		// return single control; this will never be an empty list
		var controlName = uniqueList[0];
		return controlName;
	}
	throw new Error("Invalid validation schema");
}


/**
 * Evaluate Definition
 */
function evaluate(data, paramsList, defaultParameter) {
	if (data.or) {
		or(data.or, paramsList, defaultParameter);
	} else if (data.and) {
		and(data.and, paramsList, defaultParameter);
	} else if (data.condition) { // condition
		condition(data.condition, paramsList, defaultParameter);
	} else {
		throw new Error("Failed to parse definition");
	}
}

/**
 * The 'or' condition.
 */
function or(data, paramsList, defaultParameter) {
	for (let i = 0; i < data.length; i++) {
		evaluate(data[i], paramsList, defaultParameter);
	}
}

/**
 * The 'and' condition. All sub-conditions evaluate to true.
 * Can nest any number of additional conditional types.
 * @param {Object} data an array of items
 * @return {boolean}
 */
function and(data, paramsList, defaultParameter) {
	for (let i = 0; i < data.length; i++) {
		evaluate(data[i], paramsList, defaultParameter);
	}
}

/**
 * A parameter condition.
 */
function condition(data, paramsList, defaultParameter) {
	if (data.parameter_ref) {
		paramsList.push(data.parameter_ref);
		if (data.parameter_2_ref) {
			paramsList.push(data.parameter_2_ref);
		}
	} else {
		// needed for filtering of dm fields
		paramsList.push(defaultParameter);
	}
}

// Parse the set of Controls from the form data
function parseControls(controls, formData) {
	if (formData.uiItems) {
		for (const uiItem of formData.uiItems) {
			parseUiItem(controls, uiItem);
		}
	}
	return controls;
}

function parseUiItem(controls, uiItem, panelId) {
	switch (uiItem.itemType) {
	case ItemType.CONTROL: {
		const control = uiItem.control;
		if (panelId) {
			control.summaryPanelId = panelId;
			control.summaryLabel = uiItem.control.label.text;
		}
		controls.push(control);
		if (uiItem.control.subControls) {
			for (var idx = 0; idx < uiItem.control.subControls.length; idx++) {
				const subControl = uiItem.control.subControls[idx];
				subControl.parameterName = uiItem.control.name;
				subControl.columnIndex = idx;
				if (panelId) {
					subControl.summaryPanelId = panelId;
					subControl.summaryLabel = uiItem.control.label.text;
				}
				controls.push(subControl);
			}
		}
		break;
	}
	case ItemType.ADDITIONAL_LINK:
	case ItemType.CHECKBOX_SELECTOR:
	case ItemType.PANEL: {
		if (uiItem.panel && uiItem.panel.uiItems) {
			for (const panelUiItem of uiItem.panel.uiItems) {
				parseUiItem(controls, panelUiItem, panelId);
			}
		}
		break;
	}
	case ItemType.SUMMARY_PANEL: {
		if (uiItem.panel && uiItem.panel.uiItems) {
			for (const panelUiItem of uiItem.panel.uiItems) {
				parseUiItem(controls, panelUiItem, uiItem.panel.id);
			}
		}
		break;
	}
	case ItemType.PRIMARY_TABS:
	case ItemType.PANEL_SELECTOR:
	case ItemType.SUB_TABS: {
		if (uiItem.tabs) {
			for (const tab of uiItem.tabs) {
				parseUiItem(controls, tab.content, panelId);
			}
		}
		break;
	}
	case ItemType.CUSTOM_PANEL:
		if (uiItem.panel && uiItem.panel.parameters) {
			for (const param of uiItem.panel.parameters) {
				const control = {
					name: param,
					controlType: "custom"
				};
				if (panelId) {
					control.summaryPanelId = panelId;
				}
				controls.push(control);
			}
		}
		break; // required parameters are handled by panel
	case ItemType.ACTION:
	case ItemType.STATIC_TEXT:
	case ItemType.TEXT_PANEL:
	case ItemType.HORIZONTAL_SEPARATOR: {
		break;
	}
	default:
		logger.warn("Unknown UiItem type when parsing ui conditions: " + uiItem.itemType);
		break;

	}
	return controls;

}

// Parse Require Parameters from form Data

function parseRequiredParameters(requiredParameters, formData, controls) {
	var localControls = controls;
	if (!localControls) {
		localControls = [];
		localControls = parseControls(localControls, formData);
	}
	const localRequired = localControls.filter(function(control) {
		return (control.required);
	});

	return localRequired.map(function(required) {
		return (required.name);
	});
}

// parser the condition section of the form data
function parseConditions(container, uiCondition, conditionType) {
	try {
		var controls = parseInput(uiCondition[conditionType]);
		var groupDef = {
			"params": controls,
			"definition": uiCondition
		};
		if (Array.isArray(controls) === true) {
			for (let j = 0; j < controls.length; j++) {
				if (typeof container[controls[j]] === "undefined") {
					container[controls[j]] = [];
				}
				container[controls[j]].push(groupDef);
			}
		} else { // single control
			if (typeof container[controls] === "undefined") {
				container[controls] = [];
			}
			container[controls].push(groupDef);
		}
	} catch (error) { // invalid
		logger.info("Error parsing ui conditions: " + error);
	}
	return container;
}

module.exports = {
	parseInput: parseInput,
	parseRequiredParameters: parseRequiredParameters,
	parseControls: parseControls,
	parseConditions: parseConditions
};
