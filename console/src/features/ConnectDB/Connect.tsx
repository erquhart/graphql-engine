import React from 'react';

import { Button } from '@/new-components/Button';
import { Form, InputField } from '@/new-components/Form';
import { IndicatorCard } from '@/new-components/IndicatorCard';

import { Configuration } from './components/Configuration';
import { useLoadSchema, useSubmit } from './hooks';
import { Driver } from './components/Driver';

interface Props {
  name: string;
  driver: string;
  onDriverChange: (driver: string, name: string) => void;
}

export const Connect = ({ name, driver, onDriverChange }: Props) => {
  const {
    data: { schemas, drivers, defaultValues },
    isLoading,
    isError,
  } = useLoadSchema({
    name,
    driver,
  });

  const { submit, isLoading: submitIsLoading } = useSubmit();

  if (isError) {
    return (
      <IndicatorCard status="negative">
        Error loading connection schemas
      </IndicatorCard>
    );
  }

  if (isLoading) {
    return <IndicatorCard>Loading</IndicatorCard>;
  }

  if (!schemas) {
    return (
      <IndicatorCard>
        Unable to retrieve any valid configuration settings
      </IndicatorCard>
    );
  }

  if (!drivers) {
    return <IndicatorCard>Unable to load drivers</IndicatorCard>;
  }

  return (
    <Form
      key={`${defaultValues.name}-${defaultValues.driver}` || 'new-connection'}
      schema={schemas}
      onSubmit={submit}
      options={{
        defaultValues,
      }}
      className="p-0 pl-sm"
    >
      {options => {
        return (
          <div>
            <InputField type="text" name="name" label="Database Display Name" />

            <Driver onDriverChange={onDriverChange} />

            <div className="max-w-xl">
              <p className="flex items-center font-semibold text-gray-600 mb-xs">
                Configuration
              </p>
              <Configuration name="configuration" />
            </div>
            <Button type="submit" mode="primary" isLoading={submitIsLoading}>
              Connect Database
            </Button>
            {!!Object(options.formState.errors)?.keys?.length && (
              <div className="mt-6 max-w-xl">
                <IndicatorCard status="negative">
                  Error submitting form, see error messages above
                </IndicatorCard>
              </div>
            )}
          </div>
        );
      }}
    </Form>
  );
};
