//The json object returned by mongodb has a __typename property which serves
//no purpose in TrueChops.
export function scrubTypename(value) {
    if(!value) {
        return null;
    }

    const omitTypename = (key, value) =>
    key === "__typename" ? undefined : value;
    return JSON.parse(JSON.stringify(value), omitTypename);
}