/**
 * Maps PostgreSQL column data types to ClickHouse data types.
 * Rules confirmed:
 *  - uuid    → String / Nullable(String)
 *  - boolean → String / Nullable(String)
 *  - All other types mapped per the table below.
 */
export class ClickHouseTypeMapper {
    /**
     * Map a PostgreSQL data_type (from information_schema.columns) to a
     * ClickHouse type string.
     *
     * @param pgDataType  - The "data_type" column value from information_schema
     * @param pgUdtName   - The "udt_name" column value (useful for arrays, enums)
     * @param isNullable  - Whether the column allows NULLs ("YES" | "NO")
     */
    public static map(pgDataType: string, pgUdtName: string, isNullable: string): string {
        const nullable = isNullable === 'YES';
        const baseType = this.baseType(pgDataType.toLowerCase(), pgUdtName.toLowerCase());
        return nullable ? `Nullable(${baseType})` : baseType;
    }

    private static baseType(pgDataType: string, pgUdtName: string): string {
        // Arrays — udt_name starts with underscore in PG
        if (pgUdtName.startsWith('_') || pgDataType === 'array') {
            return 'Array(String)';
        }

        switch (pgDataType) {
            // --- UUIDs and booleans → String ---
            case 'uuid':
                return 'String';
            case 'boolean':
                return 'String';

            // --- Text types ---
            case 'text':
            case 'character varying':
            case 'varchar':
            case 'character':
            case 'char':
            case 'name':
            case 'citext':
            case 'tsvector':
            case 'tsquery':
            case 'xml':
            case 'inet':
            case 'cidr':
            case 'macaddr':
            case 'point':
            case 'path':
            case 'polygon':
            case 'line':
            case 'lseg':
            case 'box':
            case 'circle':
                return 'String';

            // --- Integer types ---
            case 'smallint':
            case 'int2':
                return 'Int16';
            case 'integer':
            case 'int':
            case 'int4':
                return 'Int32';
            case 'bigint':
            case 'int8':
                return 'Int64';

            // --- Floating point ---
            case 'real':
            case 'float4':
                return 'Float32';
            case 'double precision':
            case 'float8':
                return 'Float64';

            // --- Exact numeric ---
            case 'numeric':
            case 'decimal':
                return 'Decimal(18,6)';
            case 'money':
                return 'Decimal(18,2)';

            // --- Date/time ---
            case 'timestamp without time zone':
            case 'timestamp':
                return 'DateTime';
            case 'timestamp with time zone':
            case 'timestamptz':
                return 'DateTime';
            case 'date':
                return 'Date';
            case 'time without time zone':
            case 'time with time zone':
            case 'time':
                return 'String';
            case 'interval':
                return 'String';

            // --- JSON ---
            case 'json':
            case 'jsonb':
                return 'String';

            // --- Binary ---
            case 'bytea':
                return 'String';

            // --- Serial / sequences (treated as integers) ---
            case 'smallserial':
                return 'Int16';
            case 'serial':
                return 'Int32';
            case 'bigserial':
                return 'Int64';

            // --- Enums and user-defined ---
            case 'user-defined':
                return 'String';

            default:
                return 'String';
        }
    }

    /**
     * Returns true if the given CH base type is a DateTime-family type.
     * Used by DDLBuilder to detect the primary datetime column.
     */
    public static isDateTimeType(chBaseType: string): boolean {
        return chBaseType === 'DateTime' || chBaseType === 'Date';
    }
}

export default ClickHouseTypeMapper;
