import { dataSource, Operations } from '@/dataSources';
import { ComputedField, TableColumn } from '@/dataSources/types';
import {
  useMetadataTableComputedFields,
  useMetadataTablePermissions,
} from '@/features/MetadataAPI';
import { useAllFunctions, useSchemaList, useSingleTable } from '@/hooks';

import { NewDataTarget } from '../../PermissionsTab/types/types';

export type RolePermissions = {
  [role: string]: {
    [query in 'insert' | 'select' | 'update' | 'delete']: {
      columns: (string | '*')[];
      computed_fields: (string | '*')[];
    } & {
      [key in 'check' | 'filter']: Record<string, any>;
    };
  };
};

export const getAllowedFilterKeys = (
  query: 'insert' | 'select' | 'update' | 'delete'
): ('check' | 'filter')[] => {
  switch (query) {
    case 'insert':
      return ['check'];
    case 'update':
      return ['filter', 'check'];
    default:
      return ['filter'];
  }
};

export const getRolePermission = (
  role: 'admin' | string,
  rolePermissions: RolePermissions,
  query: 'insert' | 'select' | 'update' | 'delete',
  schemaColumns: TableColumn[],
  computedFields: { scalar: ComputedField[] }
): 'fullAccess' | 'partialAccess' | 'noAccess' => {
  if (role === 'admin') {
    return 'fullAccess';
  }

  if (!rolePermissions[role]) {
    return 'noAccess';
  }

  const permissions = rolePermissions[role][query];
  if (!permissions) {
    return 'noAccess';
  }

  const filterKeys = getAllowedFilterKeys(query);
  const checkColumns = query !== 'delete';
  const checkComputedFields = query === 'select';

  if (!filterKeys.every(key => JSON.stringify(permissions[key]) === '{}')) {
    return 'partialAccess';
  }

  if (
    checkColumns &&
    (!permissions.columns ||
      (!permissions.columns.includes('*') &&
        permissions.columns.length !== schemaColumns.length))
  ) {
    return 'partialAccess';
  }

  if (
    checkComputedFields &&
    computedFields.scalar.length &&
    (!permissions.computed_fields ||
      (permissions.computed_fields.includes('*') &&
        permissions.computed_fields.length !== computedFields.scalar.length))
  ) {
    return 'partialAccess';
  }

  return 'fullAccess';
};

interface RolePermission {
  roleName: string;
  isNewRole: boolean;
  permissionTypes: {
    permissionType: Operations;
    access: 'fullAccess' | 'partialAccess' | 'noAccess';
  }[];
  bulkSelect: {
    isSelectable: boolean;
    isDisabled: boolean;
  };
}

export const useRolePermissions = (dataTarget: NewDataTarget) => {
  const table = {
    name: dataTarget.dataLeaf.leaf?.name || '',
    schema: dataTarget.dataLeaf.name,
  };

  const { data: schemas } = useSchemaList({
    source: dataTarget.dataSource.database,
    driver: dataTarget.dataSource.driver,
  });
  const { data: currentTableSchema } = useSingleTable({
    table,
    source: dataTarget.dataSource.database,
    driver: dataTarget.dataSource.driver,
  });
  const { data: permissions } = useMetadataTablePermissions(
    table,
    dataTarget.dataSource.database
  );
  const { data: computedFields } = useMetadataTableComputedFields(
    table,
    dataTarget.dataSource.database
  );
  const { data: allFunctions } = useAllFunctions(
    {
      schemas: schemas!,
      driver: dataTarget.dataSource.driver,
      source: dataTarget.dataSource.database,
    },
    { enabled: !!schemas }
  );

  if (!permissions || !allFunctions) {
    return { supportedQueries: [], rolePermissions: [] };
  }

  const currentRolePermissions = permissions.reduce((acc, p) => {
    // only add the role if it exists on the current table
    if (p.table_name === table.name) {
      acc[p.role_name] = p.permissions;
    }
    return acc;
  }, {} as Record<string, any>);

  let supportedQueries: Operations[] = [];
  if (currentTableSchema) {
    supportedQueries = dataSource.getTableSupportedQueries(currentTableSchema);
  }

  const groupedComputedFields = dataSource.getGroupedTableComputedFields(
    computedFields ?? [],
    allFunctions
  );

  const currentRoles = Object.keys(currentRolePermissions).map(roleName => ({
    roleName,
    isNewRole: false,
  }));

  const roleList = [
    { roleName: 'admin', isNewRole: false },
    ...currentRoles,
    { roleName: '', isNewRole: true },
  ];

  const rolePermissions: RolePermission[] = roleList.map(
    ({ roleName, isNewRole }) => ({
      roleName,
      isNewRole,
      permissionTypes: supportedQueries.map(queryType => ({
        permissionType: queryType,
        access: getRolePermission(
          roleName,
          currentRolePermissions,
          queryType,
          currentTableSchema?.columns || [],
          groupedComputedFields
        ),
      })),
      bulkSelect: {
        isSelectable: roleName !== 'admin' && !isNewRole,
        isDisabled: !Object.keys(currentRolePermissions).includes(roleName),
      },
    })
  );

  return { supportedQueries, rolePermissions };
};
