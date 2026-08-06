import { useFieldsStore } from '../../users/store/adminStore';

export const useSaveField = () => {
  const createField = useFieldsStore((state) => state.createField);
  const updateField = useFieldsStore((state) => state.updateField);

  const saveField = async (data, id) => {
    const formData = new FormData();

    formData.append('fieldName', data.fieldName);
    formData.append('description', data.description);
    formData.append('fieldType', data.fieldType);
    formData.append('pricePerHour', data.pricePerHour);
    formData.append('capacity', data.capacity);

    if (data.photo?.length > 0) {
      formData.append('photo', data.photo[0]);
    }

    if (id) {
      await updateField(id, formData);
      return;
    }

    await createField(formData);
  };

  return { saveField };
};
