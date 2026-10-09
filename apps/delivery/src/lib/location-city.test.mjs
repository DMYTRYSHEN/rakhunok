import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locationCityNames, matchingLocationCity, pointDistance, recommendPoints } from './location-city.ts';

test('recommendations sort working suitable points, excluding invalid coordinates and overweight parcels', () => {
	const location = { latitude: 50.45, longitude: 30.52 };
	const point = { ref: 'near', cityRef: 'city', name: 'Near', address: 'Address', number: '1', typeRef: 'type', schedule: {}, latitude: 50.451, longitude: 30.52, status: 'Working', category: 'Postomat', maxWeight: 20 };
	const far = { ...point, ref: 'far', latitude: 50.48, category: 'Branch', maxWeight: 0 };
	assert.deepEqual(recommendPoints([far, point, point, { ...point, ref: 'closed', status: 'Closed' },
		{ ...point, ref: 'small', maxWeight: 2 }, { ...point, ref: 'missing', latitude: null }], location, 5).map(item => item.ref), ['near', 'far']);
	assert.deepEqual(recommendPoints([point, far], location, 25).map(item => item.ref), ['far']);
	assert.deepEqual(recommendPoints([point], location, NaN), []);
	assert.equal(pointDistance({ latitude: 0, longitude: 0 }, location), Infinity);
	assert.equal(pointDistance({ latitude: 91, longitude: 30 }, location), Infinity);
	assert.equal(pointDistance(location, location), 0);
});

test('GPS locality is preferred and duplicates removed; IP fallback is rejected', () => {
	assert.deepEqual(locationCityNames({ countryCode: 'UA', lookupSource: 'coordinates', locality: 'Local', city: 'City' }), ['Local', 'City']);
	assert.deepEqual(locationCityNames({ countryCode: 'UA', lookupSource: 'coordinates', locality: 'City', city: 'City' }), ['City']);
	assert.deepEqual(locationCityNames({ countryCode: 'UA', lookupSource: 'ipGeolocation', city: 'City' }), []);
	assert.deepEqual(locationCityNames({ countryCode: 'PL', lookupSource: 'coordinates', city: 'City' }), []);
});

test('only exact unambiguous directory cities are selected', () => {
	const cities = [{ ref: 'one', name: 'City', area: 'First' }, { ref: 'two', name: 'City', area: 'Second' }];
	assert.equal(matchingLocationCity(cities, 'city', 'Second')?.ref, 'two');
	assert.equal(matchingLocationCity(cities, 'City', ''), null);
	assert.equal(matchingLocationCity(cities, 'Cit', 'Second'), null);
	assert.equal(matchingLocationCity(cities.slice(0, 1), ' city ', '')?.ref, 'one');
});