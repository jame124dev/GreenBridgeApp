import {
  hasFormData,
  missingRequiredFields,
  REQUIRED_FIELD_LABELS,
  type GateableRow,
} from '../missingRequiredFields';

/**
 * The Accept gate, against the web's rule
 * (`nextjs-port/.../scanv2/reviewBulk.ts:1131`).
 *
 * The cases that matter here are the ones that bite in production, not the
 * happy path: a spreadsheet row with no photograph, a row whose projection
 * carried no `form_json` (a resumed SERVER draft), and the ORDER the gaps come
 * back in — the screen sends the seller to the FIRST one, so the order is
 * behaviour, not cosmetics.
 */

/** A row with everything filled — every test starts from this and removes one. */
function complete(): GateableRow {
  return {
    title: 'KS Orbital Shaking Incubator OSI 500',
    category_name: 'Incubators and Growth Chambers',
    condition: 'usedFunctional',
    location: 'Taipei',
    thumbnail_object: 'file:///photo-1.jpg',
    form_json: {
      data: {
        operation_status: 'working',
        equipment_description: 'An orbital shaking incubator.',
      },
    },
  };
}

describe('missingRequiredFields', () => {
  it('accepts a complete row', () => {
    expect(missingRequiredFields(complete())).toEqual([]);
  });

  it('reports nothing for a null item rather than throwing', () => {
    expect(missingRequiredFields(null)).toEqual([]);
    expect(missingRequiredFields(undefined)).toEqual([]);
  });

  it.each([
    ['title', { title: null }],
    ['title', { title: '   ' }],
    ['category', { category_name: null }],
    ['condition', { condition: null }],
    ['location', { location: '' }],
  ] as const)('reports %s when it is blank', (field, patch) => {
    expect(missingRequiredFields({ ...complete(), ...patch })).toContain(field);
  });

  it('reports operationStatus and description from form_json.data', () => {
    const row = complete();
    row.form_json = { data: {} };
    const missing = missingRequiredFields(row);
    expect(missing).toContain('operationStatus');
    expect(missing).toContain('description');
  });

  it('accepts `description` under either key the extractor writes', () => {
    const row = complete();
    row.form_json = { data: { operation_status: 'working', description: 'Legacy key.' } };
    expect(missingRequiredFields(row)).not.toContain('description');
  });

  /**
   * The spreadsheet case. A catalog row gives a make, model and quantity and
   * never a picture — and the web shipped this gate with a broken Add-photo
   * control, which made every such item permanently unacceptable.
   */
  it('reports photos when the row has no image anywhere', () => {
    const row = complete();
    row.thumbnail_object = null;
    expect(missingRequiredFields(row)).toContain('photos');
  });

  it('counts a photo from image_objects_json, thumbnail, or form data', () => {
    const noThumb = { ...complete(), thumbnail_object: null };
    expect(missingRequiredFields({ ...noThumb, image_objects_json: ['a.jpg'] })).not.toContain(
      'photos',
    );
    expect(missingRequiredFields(complete())).not.toContain('photos');
    expect(
      missingRequiredFields({
        ...noThumb,
        form_json: { data: { ...(complete().form_json as { data: object }).data, image_objects: ['b.jpg'] } },
      }),
    ).not.toContain('photos');
  });

  it('treats an EMPTY image list as no photo', () => {
    const row = { ...complete(), thumbnail_object: null, image_objects_json: [] };
    expect(missingRequiredFields(row)).toContain('photos');
  });

  /**
   * A resumed SERVER draft: the list projection carries no `form_json`, so
   * those two fields are unknowable rather than empty. Reporting them missing
   * would tell the seller to fill something that may already be filled.
   */
  describe('a row with no form_json (server list projection)', () => {
    const serverRow: GateableRow = {
      title: 'Kubota 3500',
      category_name: 'Centrifugation',
      condition: 'usedFunctional',
      location: 'Taipei',
      thumbnail_object: 'gcs/object/key.jpg',
    };

    it('does not claim operationStatus or description are missing', () => {
      const missing = missingRequiredFields(serverRow);
      expect(missing).not.toContain('operationStatus');
      expect(missing).not.toContain('description');
      expect(missing).toEqual([]);
    });

    it('still gates the five fields the projection does carry', () => {
      expect(missingRequiredFields({ ...serverRow, location: null })).toEqual(['location']);
    });

    it('is distinguishable via hasFormData, so callers can be honest', () => {
      expect(hasFormData(serverRow)).toBe(false);
      expect(hasFormData(complete())).toBe(true);
    });
  });

  /**
   * ORDER IS BEHAVIOUR. Accept opens the editor on `missing[0]`, so this
   * sequence decides which field the seller is taken to. It matches the web's
   * push order in `reviewBulk.ts`.
   */
  it('reports gaps in the web order', () => {
    expect(missingRequiredFields({})).toEqual([
      'title',
      'category',
      'condition',
      'location',
      'photos',
    ]);

    expect(missingRequiredFields({ form_json: { data: {} } })).toEqual([
      'title',
      'category',
      'condition',
      'operationStatus',
      'description',
      'location',
      'photos',
    ]);
  });

  it('has a label for every field it can report', () => {
    for (const field of missingRequiredFields({ form_json: { data: {} } })) {
      expect(REQUIRED_FIELD_LABELS[field]).toBeDefined();
      expect(REQUIRED_FIELD_LABELS[field].label.length).toBeGreaterThan(0);
    }
  });
});
