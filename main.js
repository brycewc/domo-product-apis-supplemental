/* eslint require-atomic-updates: 0 */

const codeengine = require('codeengine');

class Helpers {
	/**
	 * Helper function to handle API requests and errors
	 *
	 * @param {string} method - The HTTP method
	 * @param {string} url - The endpoint URL
	 * @param {object} [body=null] - The request body
	 * @param {object} [headers=null] - The request headers
	 * @param {string} [content='application/json'] - Request body content type
	 * @returns {object} The response data
	 * @throws {error} If the request fails
	 */
	static async handleRequest(method, url, body = null, headers = null, contentType = 'application/json') {
		try {
			return await codeengine.sendRequest(method, url, body, headers, contentType);
		} catch (error) {
			console.error(
				`Error with ${method} request to ${url}\nPayload:\n${JSON.stringify(body, null, 2)}\nError:\n`,
				error
			);
			throw error;
		}
	}
}

const { handleRequest } = Helpers;

/**
 * Generates a Universally Unique Identifier (UUID)
 *
 * @returns {string} uuid
 */
function generateUUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Determine the length of the provided list
 *
 * @param {integer[]} list - The list to get the length of
 * @returns {integer} - The length of the list
 */
function getListOfNumbersLength(list) {
	return list.length;
}

/**
 * Retrieve the number at the specified index in a list
 *
 * @param {integer[]} list - The list of numbers to source from
 * @param {integer} index - The index of the number to get
 * @returns {integer} - The number at the specified index
 */
function getNumberFromList(list, index) {
	return list[index];
}

/**
 * Takes an Epoch timestamp as a number and converts it to datetime
 *
 * @param {integer} epoch - The Epoch timestamp to cast, sent as a number
 * @returns {datetime} - The number at the specified index
 */
function castEpochTimestampNumberAsDatetime(epoch) {
	return new Date(epoch);
}

/**
 * Shares a dataset with a person
 *
 * @param {Dataset} dataset - The dataset
 * @param {Person[]} person - The person to share the dataset with
 * @param {string} permission - The permission level to share the dataset with (default: 'CAN_SHARE')
 * @param {string} message - The message to include in the share email (default: 'I thought you might find this dataset interesting.')
 * @param {boolean} sendEmail - Whether to send an email notification to the person (default: false)
 * @returns {null}
 */
async function shareDataSet(
	dataset,
	person,
	permission = 'CAN_SHARE',
	message = 'I thought you might find this dataset interesting.',
	sendEmail = false
) {
	const body = {
		permissions: {
			accessLevel: permission,
			id: person,
			type: 'USER'
		},
		message,
		sendEmail
	};
	await handleRequest('POST', `/api/data/v3/datasources/${dataset}/share`, body);
}

/**
 * Deletes all cards on a given page then deletes the page
 *
 * @param {string} pageId - integer id of page to delete
 * @returns {boolean} result - true if successful
 */
async function deletePageAndCards(pageId) {
	const page = await handleRequest('GET', `/api/content/v3/stacks/${pageId}/cards`);

	const cardIds = page.cards.map((card) => card.id).join(',');

	await handleRequest('DELETE', `/api/content/v1/cards/bulk?cardIds=${cardIds}`);

	await handleRequest('DELETE', `/api/content/v1/pages/${pageId}`);

	return true;
}

/**
 * Deletes/revokes an API access token by ID
 *
 * @param {integer} accessTokenId - ID of the access token
 * @returns {null}
 */
async function deleteAccessToken(accessTokenId) {
	await handleRequest('DELETE', `api/data/v1/accesstokens/${accessTokenId}`);
}

/**
 * Updates users in bulk
 *
 * @param {object[]} users
 * 	Properties:
 * 	- id {string}
 *  - displayName {string}
 *  - title {string}
 *  - department {string}
 *  - employeeId {string}
 *  - employeeNumber {string}
 *  - hireDate {integer}
 *  - reportsTo {string}
 *  - phoneNumber {string}
 */
async function bulkUpdateUsers(users) {
	for (const user of users) {
		const { id, ...properties } = user;
		const attributes = Object.entries(properties).map(([key, value]) => ({
			key,
			values: [value === 'empty' ? null : value]
		}));
		await updateUserAttributes(id, attributes);
	}
}

/**
 * Updates reportsTo field (manager) of a user
 *
 * @param {integer} userId - ID of the user to update
 * @param {integer} managerId - ID of the manager user to set as reportsTo
 */
async function updateManager(userId, managerId) {
	const url = `/api/content/v2/users/${userId}/teams`;
	const payload = { reportsTo: [{ userId: managerId }] };
	await handleRequest('POST', url, payload);
}

/**
 * Updates specified attributes for a user
 * @param {integer} userId - ID of the user to update
 * @param {object[]} attributes - An array of attribute objects, with key and values properties
 */
async function updateUserAttributes(userId, attributes) {
	await handleRequest('PATCH', `/api/identity/v1/users/${userId}`, {
		attributes
	});
}

/**
 * Updates roles for multiple users
 * @param {Person[]} people - The people
 * @param {integer} roleId - The new role
 */
async function bulkUpdateUserRoles(people, roleId) {
	await handleRequest('PUT', `/api/authorization/v1/roles/${roleId}/users`, people);
}

/**
 * Get users that have a grant (or grants by comma separated values)
 *
 * @param {string} grant - grant or grants to search for
 * @returns {object[]} users - Array of users that have that grant
 */
async function getUsersByGrant(grant) {
	const limit = 100;
	let offset = 0;
	let hasMoreData = true;
	let users = [];

	while (hasMoreData) {
		let response = await handleRequest(
			'GET',
			`/api/content/v1/typeahead?type=userByEmail&authorities=${grant}&limit=${limit}&offset=${offset}`
		);
		console.log('Response:', response);
		if (!response || !response.users) {
			throw new Error('Invalid response from getUsersByGrant');
		}
		// Cast id to string for consistency
		response.users.forEach((user) => {
			user.id = user.id.toString();
		});

		users.push(...response.users);
		if (response.users.length < limit) {
			hasMoreData = false;
		}
		offset += limit;
	}
	return users;
}

/**
 * Gets members of a group
 *
 * @param {integer} groupId - ID of the group
 * @returns {object[]} members - Array of users in the group
 */
async function getGroupMembers(groupId) {
	const response = await handleRequest('GET', `/api/content/v2/groups/${groupId}/permissions?includeUsers=true`);
	let members = response.members.filter((m) => m.type != 'GROUP');
	return members;
}

/**
 * Updates members of a group
 *
 * @param {integer} groupId - ID of the group
 * @param {object[]} addMembers - Array of users to add
 * @param {object[]} removeMembers- Array of users to remove
 * @returns {null}
 */
async function updateGroupMembers(groupId, addMembers, removeMembers) {
	// Ensure both arrays have the correct structure
	addMembers = addMembers.map((m) => ({
		id: m.id,
		type: 'USER'
	}));
	removeMembers = removeMembers.map((m) => ({
		id: m.id,
		type: 'USER'
	}));
	// Filter out removeMembers from addMembers
	addMembers = addMembers.filter((m) => !removeMembers.some((r) => r.id === m.id));
	const body = [
		{
			groupId,
			addMembers,
			removeMembers
		}
	];
	await handleRequest('PUT', '/api/content/v2/groups/access', body);
}

/**
 * Search for users
 *
 * @param {object} query - The query to search for
 * Example:
 * {
 * "field": "reportsTo",
 * "values": [
 * "123456"
 * ],
 * "operator": "EQ",
 * "filterType": "value"
 * }
 * @returns {object[]} users - Array of users that match the query
 * Properties:
 * 	- id {integer}
 *  - displayName {string}
 *  - userName {string}
 *  - emailAddress {string}
 *  - modified {integer}
 *  - created {integer}
 *  - roleId {integer}
 *  - isSystemUser {boolean}
 *  - isActive {boolean}
 */
async function searchUsers(query) {
	const limit = 100;
	let offset = 0;
	let allUsers = [];
	let hasMoreData = true;

	while (hasMoreData) {
		const body = {
			cacheBuster: new Date().getTime(),
			showCount: true,
			count: false,
			includeDeleted: false,
			onlyDeleted: false,
			includeSupport: false,
			offset,
			limit,
			sort: {
				field: 'created',
				order: 'DESC'
			},
			filters: [query],
			parts: ['DETAILED']
		};
		const response = await handleRequest('POST', `api/identity/v1/users/search?explain=false`, body);
		try {
			const users = response.users;

			const formattedUsers = users.map((user) =>
				user.attributes.reduce(
					(map, obj) => ({
						...map,
						[obj.key]: Array.isArray(obj.values) ? obj.values[0] : undefined
					}),
					{}
				)
			);
			allUsers.push(...formattedUsers);

			const totalCount = response.count;
			if (response.users.length < limit) {
				hasMoreData = false;
			}
			if (totalCount && allUsers.length < totalCount) {
				offset += limit;
			}
		} catch (error) {
			console.error('Error processing user attributes:', error);
			hasMoreData = false;
		}
	}
	return allUsers;
}

/**
 * Get a user object from a person object
 *
 * @param {Person} person - The person
 * @returns {object} user - Information about the person
 * 	Properties:
 * 	- id {integer}
 *  - displayName {string}
 *  - userName {string}
 *  - emailAddress {string}
 *  - modified {integer}
 *  - created {integer}
 *  - roleId {integer}
 *  - isSystemUser {boolean}
 *  - isActive {boolean}
 */
async function getPerson(person) {
	const response = await handleRequest('GET', `api/identity/v1/users/${person}?parts=detailed`);
	try {
		const users = response.users;
		const firstUser = users[0];
		const attributes = firstUser.attributes;

		if (!attributes || !attributes.length) return undefined;

		const user = attributes.reduce(
			(map, obj) => ({
				...map,
				[obj.key]: Array.isArray(obj.values) ? obj.values[0] : undefined
			}),
			{}
		);
		return user;
	} catch (error) {
		console.error('Error processing user attributes:', error);
		return undefined;
	}
}

/**
 * Casts a string User ID to a person object
 *
 * @param {string} userId - ID of the user
 * @returns {Person} person - Person object
 */
async function castUserIdToPerson(userId) {
	return userId;
}

/**
 * Casts an integer User ID to a person object
 *
 * @param {integer} userId - ID of the user
 * @returns {Person} person - Person object
 */
async function castUserIdNumToPerson(userId) {
	return userId.toString();
}

/**
 * Casts an array of integer User IDs to an array of person objects
 *
 * @param {string[]} userIds - IDs of the users
 * @returns {Person[]} persons - Array of person objects
 */
async function castUserIdListToPersonList(userIds) {
	return userIds;
}

/**
 * Casts an array of integer User IDs to an array of person objects
 *
 * @param {integer[]} userIds - IDs of the users
 * @returns {Person[]} persons - Array of person objects
 */
async function castUserIdNumListToPersonList(userIds) {
	return userIds.map(String);
}

/**
 * Concatenates a list of numbers into a text string separated by the specified separator
 *
 * @param {integer[]} list - Array of integers
 * @returns {string} concatenatedList - Concatenated string of integers
 */
async function concatNumList(list, separator = ',') {
	return list.join(separator);
}

/**
 * Appends an object to an array of objects
 *
 * @param {object} object - Object to append
 * @param {object[]} list - Array of objects to append to
 * @returns {object[]} newList - Resulting array of objects
 */
async function addObjectToList(object, list = []) {
	if (list.length) {
		return list.concat(object);
	} else {
		return [object];
	}
}

/**
 * Appends a string to an array of strings
 *
 * @param {string} string - String to append
 * @param {string[]} list - Array of strings to append to
 * @returns {string[]} newList - Resulting array of strings
 */
async function addStringToList(string, list = []) {
	if (list.length) {
		return list.concat(string);
	} else {
		return [string];
	}
}

/**
 * Checks if an object is empty
 *
 * @param {object} obj - Object to check
 * @returns {boolean} empty - Whether the obj is empty or not
 */
function checkEmptyObject(obj = {}) {
	return Object.keys(obj).length === 0;
}

/**
 * Returns account properties with secrets exposed
 *
 * @param {Account} account - Account to return properties from
 * @returns {object} result - Account properties
 */
async function readAccountCredentials(account) {
	const acc = await codeengine.getAccount(account.id);
	return acc.properties;
}
