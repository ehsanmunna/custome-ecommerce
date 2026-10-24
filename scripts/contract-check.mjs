import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = path.join(root, 'apps', 'api', 'openapi', 'openapi.yaml');

const httpMethods = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

function localReference(document, ref) {
  if (!ref?.startsWith('#/')) return undefined;
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, key) => value?.[key], document);
}

function resolveSchema(document, schema, depth = 0) {
  if (!schema || depth > 12) return {};
  const resolved = schema.$ref
    ? resolveSchema(document, localReference(document, schema.$ref), depth + 1)
    : {};
  const properties = { ...resolved.properties, ...schema.properties };
  const required = new Set([...(resolved.required ?? []), ...(schema.required ?? [])]);
  for (const part of schema.allOf ?? []) {
    const merged = resolveSchema(document, part, depth + 1);
    Object.assign(properties, merged.properties);
    for (const property of merged.required ?? []) required.add(property);
  }
  return {
    ...resolved,
    ...schema,
    properties,
    required: [...required],
  };
}

function resolveParameter(document, parameter) {
  return parameter?.$ref ? localReference(document, parameter.$ref) : parameter;
}

function operationEntries(document) {
  return Object.entries(document.paths ?? {}).flatMap(([route, pathItem]) =>
    Object.entries(pathItem).flatMap(([method, operation]) =>
      httpMethods.has(method) ? [{ route, method, pathItem, operation }] : [],
    ),
  );
}

function inspectControllerRoutes() {
  const apiSource = path.join(root, 'apps', 'api', 'src');
  const files = [];

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(fullPath);
    }
  }

  walk(apiSource);
  const routes = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement)) continue;
      const decorators = ts.canHaveDecorators(statement) ? (ts.getDecorators(statement) ?? []) : [];
      const controller = decorators.find((decorator) => decoratorName(decorator) === 'controller');
      if (!controller) continue;
      const prefix = decoratorStringArgument(controller);
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const methodDecorators = ts.canHaveDecorators(member)
          ? (ts.getDecorators(member) ?? [])
          : [];
        for (const decorator of methodDecorators) {
          const method = decoratorName(decorator);
          if (!httpMethods.has(method)) continue;
          const suffix = decoratorStringArgument(decorator);
          const route = `/${[prefix, suffix].filter(Boolean).join('/')}`
            .replace(/\/+/g, '/')
            .replace(/\/$/, '');
          routes.push({ method, route: route || '/' });
        }
      }
    }
  }
  return routes;
}

function decoratorName(decorator) {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
    return expression.expression.text.toLowerCase();
  }
  return '';
}

function decoratorStringArgument(decorator) {
  const expression = decorator.expression;
  const argument = ts.isCallExpression(expression) ? expression.arguments[0] : undefined;
  return argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : '';
}

function validateContract(document, implementedRoutes) {
  const issues = [];
  const entries = operationEntries(document);
  const operationIds = new Set();
  const definedTags = new Set((document.tags ?? []).map((tag) => tag.name));
  const contractRoutes = new Set(
    entries.map(({ method, route }) => `${method.toUpperCase()} ${route}`),
  );
  const declaredRuntimeRoutes = new Set(document['x-implemented-operations'] ?? []);

  if (!document.openapi?.startsWith('3.1.')) {
    issues.push('OpenAPI version must be 3.1.x.');
  }
  if (!(document.servers ?? []).some((server) => server.url.replace(/\/+$/, '') === '/v1')) {
    issues.push('The API server base path must be /v1.');
  }

  for (const { route, method, pathItem, operation } of entries) {
    if (!operation.operationId) {
      issues.push(`${method.toUpperCase()} ${route} is missing operationId.`);
    } else if (operationIds.has(operation.operationId)) {
      issues.push(`Duplicate operationId: ${operation.operationId}.`);
    }
    operationIds.add(operation.operationId);

    for (const tag of operation.tags ?? []) {
      if (!definedTags.has(tag)) issues.push(`${operation.operationId} uses undefined tag ${tag}.`);
    }

    const access = operation['x-access'];
    if (!['public', 'customer', 'admin'].includes(access)) {
      issues.push(`${operation.operationId} must declare x-access as public, customer, or admin.`);
    }
    const security = operation.security ?? [];
    const usesBearer = security.some((requirement) => Object.hasOwn(requirement, 'bearerAuth'));
    if (access === 'public' && security.length !== 0) {
      issues.push(`${operation.operationId} is public but has security requirements.`);
    }
    if (['customer', 'admin'].includes(access) && !usesBearer) {
      issues.push(`${operation.operationId} requires bearer authentication.`);
    }
    if (access === 'admin' && !operation['x-required-permission']) {
      issues.push(`${operation.operationId} is missing x-required-permission.`);
    }
    const responses = operation.responses ?? {};
    if (!responses.default || !responses.default.$ref) {
      issues.push(`${operation.operationId} must reference the shared default error response.`);
    }

    const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map(
      (parameter) => resolveParameter(document, parameter),
    );
    for (const name of route.matchAll(/\{([^}]+)\}/g)) {
      if (!parameters.some((parameter) => parameter?.in === 'path' && parameter.name === name[1])) {
        issues.push(`${operation.operationId} is missing path parameter ${name[1]}.`);
      }
    }

    if (/^(list|search)/i.test(operation.operationId)) {
      const queryNames = new Set(
        parameters
          .filter((parameter) => parameter?.in === 'query')
          .map((parameter) => parameter.name),
      );
      if (!queryNames.has('page') || !queryNames.has('pageSize')) {
        issues.push(`${operation.operationId} must use page and pageSize parameters.`);
      }
      const hasPageResponse = Object.values(responses).some((response) => {
        const responseObject = response?.$ref ? localReference(document, response.$ref) : response;
        return Object.values(responseObject?.content ?? {}).some((content) =>
          /Page$/.test(content.schema?.$ref?.split('/').at(-1) ?? ''),
        );
      });
      if (!hasPageResponse) {
        issues.push(`${operation.operationId} must return a paginated response schema.`);
      }
    }
  }

  const contractSet = new Set(declaredRuntimeRoutes);
  const implementedSet = new Set(
    implementedRoutes.map(({ method, route }) => `${method.toUpperCase()} ${route}`),
  );
  for (const route of implementedSet) {
    if (!contractRoutes.has(route)) issues.push(`Implemented route is undocumented: ${route}.`);
    if (!contractSet.has(route))
      issues.push(`Implemented route is not declared in x-implemented-operations: ${route}.`);
  }
  for (const route of contractSet) {
    if (!implementedSet.has(route))
      issues.push(`Declared runtime route is not implemented: ${route}.`);
    if (!contractRoutes.has(route))
      issues.push(`Declared runtime route is absent from paths: ${route}.`);
  }

  for (const [schemaName, propertyName] of [
    ['PasswordLoginRequest', 'password'],
    ['AdminUserCreate', 'password'],
    ['RefreshRequest', 'refreshToken'],
    ['OtpVerifyRequest', 'code'],
  ]) {
    if (!document.components?.schemas?.[schemaName]?.properties?.[propertyName]?.writeOnly) {
      issues.push(`${schemaName}.${propertyName} must be writeOnly.`);
    }
  }

  return issues;
}

function compareSchema(oldDocument, newDocument, oldSchema, newSchema, location, issues, request) {
  const before = resolveSchema(oldDocument, oldSchema);
  const after = resolveSchema(newDocument, newSchema);

  if (before.type && after.type && JSON.stringify(before.type) !== JSON.stringify(after.type)) {
    issues.push(`${location} changes its schema type.`);
  }
  if (after.enum && (!before.enum || before.enum.some((value) => !after.enum.includes(value)))) {
    issues.push(`${location} narrows an enum.`);
  }
  for (const constraint of ['minimum', 'minLength', 'minItems', 'minProperties']) {
    if (
      after[constraint] !== undefined &&
      (before[constraint] === undefined || after[constraint] > before[constraint])
    ) {
      issues.push(`${location} tightens ${constraint}.`);
    }
  }
  for (const constraint of ['maximum', 'maxLength', 'maxItems', 'maxProperties']) {
    if (
      after[constraint] !== undefined &&
      (before[constraint] === undefined || after[constraint] < before[constraint])
    ) {
      issues.push(`${location} tightens ${constraint}.`);
    }
  }
  if (after.pattern && before.pattern !== after.pattern) {
    issues.push(`${location} changes its validation pattern.`);
  }
  if (request) {
    for (const required of before.required ?? []) {
      if (!(after.required ?? []).includes(required)) {
        issues.push(`${location} no longer requires ${required}.`);
      }
    }
    for (const required of after.required ?? []) {
      if (!(before.required ?? []).includes(required)) {
        issues.push(`${location} makes ${required} newly required.`);
      }
    }
  }
  for (const [name, oldProperty] of Object.entries(before.properties ?? {})) {
    const newProperty = after.properties?.[name];
    if (!newProperty) {
      issues.push(`${location} removes property ${name}.`);
      continue;
    }
    compareSchema(
      oldDocument,
      newDocument,
      oldProperty,
      newProperty,
      `${location}.${name}`,
      issues,
      request,
    );
  }
}

function findBreakingChanges(oldDocument, newDocument) {
  const issues = [];
  for (const [route, oldPathItem] of Object.entries(oldDocument.paths ?? {})) {
    const newPathItem = newDocument.paths?.[route];
    if (!newPathItem) {
      issues.push(`Removes path ${route}.`);
      continue;
    }
    for (const method of httpMethods) {
      const oldOperation = oldPathItem[method];
      if (!oldOperation) continue;
      const newOperation = newPathItem[method];
      if (!newOperation) {
        issues.push(`Removes ${method.toUpperCase()} ${route}.`);
        continue;
      }
      if (oldOperation['x-access'] !== newOperation['x-access']) {
        issues.push(`${method.toUpperCase()} ${route} changes its access level.`);
      }
      if (oldOperation['x-required-permission'] !== newOperation['x-required-permission']) {
        issues.push(`${method.toUpperCase()} ${route} changes its required permission.`);
      }
      const newParameters = new Map(
        [...(newPathItem.parameters ?? []), ...(newOperation.parameters ?? [])]
          .map((parameter) => resolveParameter(newDocument, parameter))
          .map((parameter) => [`${parameter.in}:${parameter.name}`, parameter]),
      );
      const oldParameters = new Map(
        [...(oldPathItem.parameters ?? []), ...(oldOperation.parameters ?? [])]
          .map((parameter) => resolveParameter(oldDocument, parameter))
          .map((parameter) => [`${parameter.in}:${parameter.name}`, parameter]),
      );
      for (const parameterRef of [
        ...(oldPathItem.parameters ?? []),
        ...(oldOperation.parameters ?? []),
      ]) {
        const parameter = resolveParameter(oldDocument, parameterRef);
        const current = newParameters.get(`${parameter.in}:${parameter.name}`);
        if (!current) {
          issues.push(`${method.toUpperCase()} ${route} removes parameter ${parameter.name}.`);
        } else if (!parameter.required && current.required) {
          issues.push(
            `${method.toUpperCase()} ${route} makes parameter ${parameter.name} required.`,
          );
        } else {
          compareSchema(
            oldDocument,
            newDocument,
            parameter.schema,
            current.schema,
            `${method.toUpperCase()} ${route} parameter ${parameter.name}`,
            issues,
            true,
          );
        }
      }
      for (const [key, parameter] of newParameters) {
        if (parameter.required && !oldParameters.has(key)) {
          issues.push(
            `${method.toUpperCase()} ${route} adds required parameter ${parameter.name}.`,
          );
        }
      }

      if (oldOperation.requestBody) {
        const oldBody = oldOperation.requestBody.$ref
          ? localReference(oldDocument, oldOperation.requestBody.$ref)
          : oldOperation.requestBody;
        const newBody = newOperation.requestBody?.$ref
          ? localReference(newDocument, newOperation.requestBody.$ref)
          : newOperation.requestBody;
        if (!newBody) {
          issues.push(`${method.toUpperCase()} ${route} removes its request body.`);
        } else {
          if (!oldBody.required && newBody.required) {
            issues.push(`${method.toUpperCase()} ${route} makes its request body required.`);
          }
          compareSchema(
            oldDocument,
            newDocument,
            oldBody.content?.['application/json']?.schema,
            newBody.content?.['application/json']?.schema,
            `${method.toUpperCase()} ${route} request`,
            issues,
            true,
          );
        }
      }

      for (const [status, oldResponseRef] of Object.entries(oldOperation.responses ?? {})) {
        const newResponseRef = newOperation.responses?.[status];
        if (!newResponseRef) {
          issues.push(`${method.toUpperCase()} ${route} removes response ${status}.`);
          continue;
        }
        const oldResponse = oldResponseRef.$ref
          ? localReference(oldDocument, oldResponseRef.$ref)
          : oldResponseRef;
        const newResponse = newResponseRef.$ref
          ? localReference(newDocument, newResponseRef.$ref)
          : newResponseRef;
        for (const [mediaType, oldContent] of Object.entries(oldResponse?.content ?? {})) {
          const newContent = newResponse?.content?.[mediaType];
          if (!newContent) {
            issues.push(
              `${method.toUpperCase()} ${route} removes ${mediaType} from response ${status}.`,
            );
            continue;
          }
          if (!oldContent.schema || !newContent.schema) continue;
          compareSchema(
            oldDocument,
            newDocument,
            oldContent.schema,
            newContent.schema,
            `${method.toUpperCase()} ${route} response ${status}`,
            issues,
            false,
          );
        }
      }
    }
  }
  return issues;
}

function readContract(filePath) {
  return parse(readFileSync(filePath, 'utf8'));
}

function readBaselineContract() {
  const baselineRef = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : process.env.GITHUB_EVENT_NAME === 'push'
      ? 'HEAD^'
      : 'HEAD';
  execFileSync('git', ['rev-parse', '--verify', baselineRef], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const baselineFile = `${baselineRef}:apps/api/openapi/openapi.yaml`;
  try {
    return execFileSync('git', ['show', baselineFile], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const document = readContract(contractPath);
  const implementedRoutes = inspectControllerRoutes();
  const issues = validateContract(document, implementedRoutes);
  if (issues.length) {
    console.error(issues.map((issue) => `- ${issue}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Contract checks passed (${operationEntries(document).length} operations).`);
  }

  const baseline = readBaselineContract();
  if (baseline) {
    const compatibilityIssues = findBreakingChanges(parse(baseline), document);
    if (compatibilityIssues.length) {
      console.error(
        `Breaking v1 contract changes detected:\n${compatibilityIssues.map((issue) => `- ${issue}`).join('\n')}`,
      );
      process.exitCode = 1;
    } else {
      console.log('No breaking changes from HEAD contract.');
    }
  } else {
    console.log(
      'The selected Git baseline has no prior contract; establishing the initial v1 baseline.',
    );
  }
}

export {
  findBreakingChanges,
  inspectControllerRoutes,
  operationEntries,
  readContract,
  validateContract,
};
