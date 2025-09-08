/* eslint require-atomic-updates: 0 */

const codeengine = require('codeengine');

class Helpers {
	/**
	 * Helper function to handle API requests and errors
	 * @param {text} method - The HTTP method
	 * @param {text} url - The endpoint URL
	 * @param {Object} [body=null] - The request body
	 * @param {Object} [headers=null] - The request headers
	 * @param {text} [content='application/json'] - Request body content type
	 * @returns {Object} The response data
	 * @throws {Error} If the request fails
	 */
	static async handleRequest(
		method,
		url,
		body = null,
		headers = null,
		contentType = 'application/json'
	) {
		try {
			return await codeengine.sendRequest(
				method,
				url,
				body,
				headers,
				contentType
			);
		} catch (error) {
			console.error(
				`Error with ${method} request to ${url}\nPayload:\n${JSON.stringify(
					body,
					null,
					2
				)}\nError:\n`,
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
 * @param {number[]} list - The list to get the length of
 * @returns {number} - The length of the list
 */
function getListOfNumbersLength(list) {
	return list.length;
}

/**
 * Retrieve the number at the specified index in a list
 *
 * @param {number[]} list - The list of numbers to source from
 * @param {number} index - The index of the number to get
 * @returns {number} - The number at the specified index
 */
function getNumberFromList(list, index) {
	return list[index];
}

/**
 * Retrieve the number at the specified index in a list
 *
 * @param {number} epoch - The Epoch timestamp to cast, sent as a number
 * @returns {datetime} - The number at the specified index
 */
function castEpochTimestampNumberAsDatetime(epoch) {
	return new Date(epoch);
}

/**
 * Deletes all cards on a given page then deletes the page
 *
 * @param {text} pageId - integer id of page to delete
 * @returns {boolean} result - true if successful
 */
async function deletePageAndCards(pageId) {
	const page = await handleRequest(
		'GET',
		`/api/content/v3/stacks/${pageId}/cards`
	);

	const cardIds = page.cards.map((card) => card.id).join(',');

	await handleRequest(
		'DELETE',
		`/api/content/v1/cards/bulk?cardIds=${cardIds}`
	);

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
 * Get a user object from a person object
 *
 * @param {Person} person - The person
 * @returns {object} user - Information about the person
 */
async function getPerson(person) {
	const response = await handleRequest(
		'GET',
		`api/identity/v1/users/${person}?parts=detailed`
	);
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
 * Updates users in bulk
 *
 * @param {array of objects} users - array of user objects
 * @returns {boolean} result - true if successful
 */
async function bulkUpdateUsers(users) {
	const body = {
		transactionId: generateUUID(),
		users
	};
	const updateUsersResponse = await handleRequest(
		'PUT',
		'api/content/v2/users/bulk'
	);
	return true;
}

/**
 * Updates reportsTo field (manager) of a user
 *
 * @param {integer} userId - ID of user to update
 * @param {integer} managerId - ID of the manager user to set as reportsTo
 * @returns {null}
 */
async function updateManager(userId, managerId) {
	const url = `/api/content/v2/users/${userId}/teams`;
	const payload = { reportsTo: [{ userId: managerId }] };
	await handleRequest('POST', url, payload);
}

/**
 * Get users that have a grant (or grants by comma separated values)
 *
 * @param {string} grant - grant or grants to search for
 * @returns {array of objects} users - Array of users that have that grant
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
 * @returns {array of objects} members - Array of users in the group
 */
async function getGroupMembers(groupId) {
	const response = await handleRequest(
		'GET',
		`/api/content/v2/groups/${groupId}/permissions?includeUsers=true`
	);
	let members = response.members.filter((m) => m.type != 'GROUP');
	return members;
}

/**
 * Updates members of a group
 *
 * @param {integer} groupId - ID of the group
 * @param {array of objects} addMembers - Array of users to add
 * @param {array of objects} removeMembers- Array of users to remove
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
	addMembers = addMembers.filter(
		(m) => !removeMembers.some((r) => r.id === m.id)
	);
	const body = [
		{
			groupId,
			addMembers,
			removeMembers
		}
	];
	await handleRequest('PUT', '/api/content/v2/groups/access', body);
}
