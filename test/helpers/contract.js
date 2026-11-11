import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv/dist/2020.js';
import assert from 'node:assert/strict';
export const contract = await SwaggerParser.validate(new URL('../../openapi.yaml', import.meta.url).pathname);
const ajv = new Ajv({ strict: false, validateFormats: false });
export function checkSchema(name, value) {
  const validate = ajv.compile(contract.components.schemas[name]);
  assert.ok(validate(value), name + ': ' + JSON.stringify(validate.errors));
}
export function checkResponse(path, method, status, value) {
  const response = contract.paths[path][method].responses[status];
  assert.ok(response, `Undocumented response: ${method} ${path} ${status}`);
  const validate = ajv.compile(response.content['application/json'].schema);
  assert.ok(validate(value), JSON.stringify(validate.errors));
}
