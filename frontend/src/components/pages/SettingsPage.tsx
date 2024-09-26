import React, { useEffect, useRef } from 'react'
import { Box, Typography, FormControl, FormControlLabel, Radio, RadioGroup, TextField, Button } from '@mui/material'
import { useForm, Control, Controller, useFieldArray } from 'react-hook-form'
import { useSettingsState, Settings } from '../../machines/appStateMachine'

type EndpointTextFieldProps = {
  name: string
  control: Control<SettingsForm>
  label: string
}

const EndpointTextField: React.FC<EndpointTextFieldProps> = ({ name, control, label }) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => <TextField {...field} fullWidth label={label} variant="outlined" sx={{ mb: 2 }} />}
    />
  )
}

type SettingsForm = Omit<Settings, 'apiAuthHeaders'> & {
  apiAuthHeaders: { key: string; value: string }[]
  fetchSchemaEndpoint: string
  submitQueryEndpoint: string
  translateQueryEndpoint: string
  fetchEntityShapesEndpoint: string
}

const SettingsPage: React.FC = () => {
  const { settings, handleSettingsChange } = useSettingsState()
  console.log('settings', settings)

  const { control, handleSubmit, watch, setValue } = useForm<SettingsForm>({
    defaultValues: {
      theme: settings.theme,
      apiUrl: settings.apiUrl,
      apiAuthHeaders: Object.entries(settings.apiAuthHeaders).map(([key, value]) => ({ key, value: value as string })),
      fetchSchemaEndpoint: settings.fetchSchemaEndpoint,
      submitQueryEndpoint: settings.submitQueryEndpoint,
      translateQueryEndpoint: settings.translateQueryEndpoint,
      fetchEntityShapesEndpoint: settings.fetchEntityShapesEndpoint
    }
  })

  const baseUrl = watch('apiUrl')
  const prevBaseUrlRef = useRef(baseUrl)

  useEffect(() => {
    const currentFetchSchema = watch('fetchSchemaEndpoint')
    const currentSubmitQuery = watch('submitQueryEndpoint')
    const currentTranslateQuery = watch('translateQueryEndpoint')
    const currentFetchEntityShapes = watch('fetchEntityShapesEndpoint')
    const prevBaseUrl = prevBaseUrlRef.current
    const removePrevBaseUrl = (url: string) => url.replace(new RegExp(`^${prevBaseUrl}`), '')

    setValue('fetchSchemaEndpoint', `${baseUrl}${removePrevBaseUrl(currentFetchSchema)}`)
    setValue('submitQueryEndpoint', `${baseUrl}${removePrevBaseUrl(currentSubmitQuery)}`)
    setValue('translateQueryEndpoint', `${baseUrl}${removePrevBaseUrl(currentTranslateQuery)}`)
    setValue('fetchEntityShapesEndpoint', `${baseUrl}${removePrevBaseUrl(currentFetchEntityShapes)}`)

    prevBaseUrlRef.current = baseUrl
  }, [baseUrl, setValue, watch])

  const onSubmit = (data: SettingsForm) => {
    const apiAuthHeaders = data.apiAuthHeaders.reduce((acc: Record<string, string>, { key, value }) => {
      if (key && value) {
        acc[key] = value
      }
      return acc
    }, {})
    handleSettingsChange({ ...data, apiAuthHeaders })
  }

  const { fields, append, remove } = useFieldArray({ control, name: 'apiAuthHeaders' })

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            App Theme
          </Typography>
          <Controller
            name="theme"
            control={control}
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel value="light" control={<Radio />} label="Light" />
                <FormControlLabel value="dark" control={<Radio />} label="Dark" />
              </RadioGroup>
            )}
          />
        </FormControl>
        <Typography variant="h6" gutterBottom>
          API Settings
        </Typography>
        <Controller
          name="apiUrl"
          control={control}
          render={({ field }) => <TextField {...field} fullWidth label="API URL" variant="outlined" sx={{ mb: 2 }} />}
        />
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          API Endpoints
        </Typography>
        <EndpointTextField name="fetchSchemaEndpoint" control={control} label="Fetch Schema Endpoint" />
        <EndpointTextField name="submitQueryEndpoint" control={control} label="Submit Query Endpoint" />
        <EndpointTextField name="translateQueryEndpoint" control={control} label="Translate Query Endpoint" />
        <EndpointTextField name="fetchEntityShapesEndpoint" control={control} label="Fetch Entity Shapes Endpoint" />
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            API Request Headers
          </Typography>
          {fields.map((field, index) => (
            <Box key={field.id} sx={{ display: 'flex', mb: 2 }}>
              <Controller
                name={`apiAuthHeaders.${index}.key`}
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Header Name" variant="outlined" sx={{ mr: 1, flex: 1 }} />
                )}
              />
              <Controller
                name={`apiAuthHeaders.${index}.value`}
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Header Value" variant="outlined" sx={{ mr: 1, flex: 1 }} />
                )}
              />
              <Button onClick={() => remove(index)} variant="outlined" color="error">
                Remove
              </Button>
            </Box>
          ))}
          <Button onClick={() => append({ key: '', value: '' })} variant="outlined" sx={{ mt: 1 }}>
            Add Header
          </Button>
        </Box>
        <Button variant="contained" type="submit" sx={{ mt: 2 }}>
          Save Settings
        </Button>
      </form>
    </Box>
  )
}

export default SettingsPage
