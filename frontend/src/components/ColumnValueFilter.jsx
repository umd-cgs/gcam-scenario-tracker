import { useId } from "react";
import Select from "react-select";
import { asText } from "../lib.js";

export default function ColumnValueFilter({ column }) {
  const id = useId();
  const selected = column.getFilterValue() || [];
  // Facets include all pages and respect other active filters, excluding this column's filter.
  const values = new Set(
    [...column.getFacetedUniqueValues().keys()].map(asText),
  );
  selected.forEach((value) => values.add(value));
  const toOption = (value) => ({ value, label: value || "Unassigned" });
  const options = [...values].sort((a, b) => a.localeCompare(b)).map(toOption);
  return (
    <Select
      instanceId={id}
      aria-label={`Filter ${column.columnDef.header}`}
      className="column-value-filter"
      classNamePrefix="value-filter"
      unstyled
      isMulti
      isClearable
      openMenuOnFocus
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      options={options}
      value={selected.map(toOption)}
      onChange={(choices) =>
        column.setFilterValue(
          choices.length ? choices.map(({ value }) => value) : undefined,
        )
      }
      placeholder="All"
      noOptionsMessage={() => "No matching values"}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      menuPlacement="auto"
      maxMenuHeight={240}
      styles={{ menuPortal: (base) => ({ ...base, zIndex: 30 }) }}
    />
  );
}
