import type { AgentBridgeManifest } from '../types.js';

export const revenuecatManifest: AgentBridgeManifest = {
  "schema_version": "1.0",
  "name": "revenuecat",
  "description": "RevenueCat Developer API — projects, metrics, charts, customers, subscriptions, and growth operations",
  "version": "2.0.0",
  "base_url": "https://api.revenuecat.com/v2",
  "auth": {
    "type": "bearer",
    "instructions": "Create a RevenueCat Secret API key (V2) in Project settings > API keys and set it with agentbridge auth revenuecat --token sk_..."
  },
  "actions": [
    {
      "id": "list-projects",
      "description": "Get a list of projects",
      "method": "GET",
      "path": "/projects",
      "parameters": [
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        }
      ]
    },
    {
      "id": "list-apps",
      "description": "Get a list of apps",
      "method": "GET",
      "path": "/projects/{project_id}/apps",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        }
      ]
    },
    {
      "id": "get-overview-metrics",
      "description": "Get overview metrics for a project",
      "method": "GET",
      "path": "/projects/{project_id}/metrics/overview",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "currency",
          "description": "ISO 4217 currency code",
          "in": "query",
          "required": false,
          "type": "string",
          "enum": [
            "USD",
            "EUR",
            "GBP",
            "AUD",
            "CAD",
            "JPY",
            "BRL",
            "KRW",
            "CNY",
            "MXN",
            "SEK",
            "PLN"
          ]
        }
      ]
    },
    {
      "id": "get-chart-options",
      "description": "Get available options for a chart",
      "method": "GET",
      "path": "/projects/{project_id}/charts/{chart_name}/options",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "chart_name",
          "description": "Name of the chart to retrieve.\n",
          "in": "path",
          "required": true,
          "type": "string",
          "enum": [
            "actives",
            "actives_movement",
            "actives_new",
            "arr",
            "churn",
            "cohort_explorer",
            "conversion_to_paying",
            "customers_new",
            "ltv_per_customer",
            "ltv_per_paying_customer",
            "mrr",
            "mrr_movement",
            "refund_rate",
            "revenue",
            "subscription_retention",
            "subscription_status",
            "trials",
            "trials_movement",
            "trials_new",
            "customers_active",
            "trial_conversion_rate"
          ]
        },
        {
          "name": "realtime",
          "description": "Whether to request real-time (v3) charts. Defaults to true. Set to false to request the v2 charts.",
          "in": "query",
          "required": false,
          "type": "boolean",
          "default": true
        }
      ]
    },
    {
      "id": "get-chart-data",
      "description": "Get chart data",
      "method": "GET",
      "path": "/projects/{project_id}/charts/{chart_name}",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "chart_name",
          "description": "Name of the chart to retrieve.\n",
          "in": "path",
          "required": true,
          "type": "string",
          "enum": [
            "actives",
            "actives_movement",
            "actives_new",
            "arr",
            "churn",
            "cohort_explorer",
            "conversion_to_paying",
            "customers_new",
            "ltv_per_customer",
            "ltv_per_paying_customer",
            "mrr",
            "mrr_movement",
            "refund_rate",
            "revenue",
            "subscription_retention",
            "subscription_status",
            "trials",
            "trials_movement",
            "trials_new",
            "customers_active",
            "trial_conversion_rate"
          ]
        },
        {
          "name": "realtime",
          "description": "Whether to request real-time (v3) charts. Defaults to true. Set to false to request the v2 charts.",
          "in": "query",
          "required": false,
          "type": "boolean",
          "default": true
        },
        {
          "name": "filters",
          "description": "JSON array of chart filters. Each filter is a ChartFilter object.",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "selectors",
          "description": "JSON object of chart selectors.",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "aggregate",
          "description": "Comma-separated aggregate operations to return in `summary` without raw `values`.\n",
          "in": "query",
          "required": false,
          "type": "array"
        },
        {
          "name": "currency",
          "description": "ISO 4217 currency code",
          "in": "query",
          "required": false,
          "type": "string",
          "enum": [
            "USD",
            "EUR",
            "GBP",
            "AUD",
            "CAD",
            "JPY",
            "BRL",
            "KRW",
            "CNY",
            "MXN",
            "SEK",
            "PLN"
          ]
        },
        {
          "name": "resolution",
          "description": "Time resolution for the chart data.\nUse the chart options endpoint to discover available resolutions and their IDs.\n",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "start_date",
          "description": "Start date for the data range (ISO 8601 format)",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "end_date",
          "description": "End date for the data range (ISO 8601 format)",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "segment",
          "description": "Segment the data by this dimension. Use the chart options endpoint\nto discover available segments for a chart.\n",
          "in": "query",
          "required": false,
          "type": "string"
        }
      ]
    },
    {
      "id": "list-customers",
      "description": "Get a list of customers",
      "method": "GET",
      "path": "/projects/{project_id}/customers",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        },
        {
          "name": "search",
          "description": "Search term. Currently, only searching by email is supported (searching for exact matches in the $email attribute).",
          "in": "query",
          "required": false,
          "type": "string"
        }
      ]
    },
    {
      "id": "get-customer",
      "description": "Get a customer",
      "method": "GET",
      "path": "/projects/{project_id}/customers/{customer_id}",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "expand",
          "description": "Specifies which fields in the response should be expanded.\n Accepted values are: `attributes` (requires `customer_information:customers:read` permission).",
          "in": "query",
          "required": false,
          "type": "array"
        }
      ]
    },
    {
      "id": "create-customer",
      "description": "Create a customer",
      "method": "POST",
      "path": "/projects/{project_id}/customers",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "id",
          "description": "The ID of the customer",
          "in": "body",
          "required": true,
          "type": "string"
        },
        {
          "name": "attributes",
          "description": "attributes",
          "in": "body",
          "required": false,
          "type": "array"
        }
      ],
      "confirm": true
    },
    {
      "id": "set-customer-attributes",
      "description": "Set a customer's attributes",
      "method": "POST",
      "path": "/projects/{project_id}/customers/{customer_id}/attributes",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "attributes",
          "description": "attributes",
          "in": "body",
          "required": true,
          "type": "array"
        }
      ],
      "confirm": true
    },
    {
      "id": "list-customer-attributes",
      "description": "Get a list of the customer's attributes",
      "method": "GET",
      "path": "/projects/{project_id}/customers/{customer_id}/attributes",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        }
      ]
    },
    {
      "id": "list-subscriptions",
      "description": "Get a list of subscriptions associated with a customer",
      "method": "GET",
      "path": "/projects/{project_id}/customers/{customer_id}/subscriptions",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "environment",
          "description": "environment",
          "in": "query",
          "required": false,
          "type": "string",
          "enum": [
            "sandbox",
            "production"
          ]
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        }
      ]
    },
    {
      "id": "list-purchases",
      "description": "Get a list of purchases associated with a customer",
      "method": "GET",
      "path": "/projects/{project_id}/customers/{customer_id}/purchases",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "environment",
          "description": "environment",
          "in": "query",
          "required": false,
          "type": "string",
          "enum": [
            "sandbox",
            "production"
          ]
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        }
      ]
    },
    {
      "id": "list-customer-active-entitlements",
      "description": "Get a list of customer's active entitlements",
      "method": "GET",
      "path": "/projects/{project_id}/customers/{customer_id}/active_entitlements",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        }
      ]
    },
    {
      "id": "search-subscriptions",
      "description": "Search subscriptions by store subscription identifier",
      "method": "GET",
      "path": "/projects/{project_id}/subscriptions",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "store_subscription_identifier",
          "description": "Store ID associated with the subscription for the current or next period.",
          "in": "query",
          "required": true,
          "type": "string"
        }
      ]
    },
    {
      "id": "search-purchases",
      "description": "Search one-time purchases by store purchase identifier",
      "method": "GET",
      "path": "/projects/{project_id}/purchases",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "store_purchase_identifier",
          "description": "Store ID associated with the one-time purchase.",
          "in": "query",
          "required": true,
          "type": "string"
        }
      ]
    },
    {
      "id": "list-offerings",
      "description": "Get a list of offerings",
      "method": "GET",
      "path": "/projects/{project_id}/offerings",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        },
        {
          "name": "expand",
          "description": "Specifies which fields in the response should be expanded.\n Accepted values are: `items.package` (requires `project_configuration:packages:read` permission), `items.package.product` (requires `project_configuration:products:read` permission).",
          "in": "query",
          "required": false,
          "type": "array"
        }
      ]
    },
    {
      "id": "list-products",
      "description": "Get a list of products",
      "method": "GET",
      "path": "/projects/{project_id}/products",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "app_id",
          "description": "This is an optional query parameter to get a list of products of a given entitlement associated with a particular app",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        },
        {
          "name": "expand",
          "description": "Specifies which fields in the response should be expanded.\n Accepted values are: `items.app` (requires `project_configuration:apps:read` permission).",
          "in": "query",
          "required": false,
          "type": "array"
        }
      ]
    },
    {
      "id": "list-entitlements",
      "description": "Get a list of entitlements",
      "method": "GET",
      "path": "/projects/{project_id}/entitlements",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        },
        {
          "name": "expand",
          "description": "Specifies which fields in the response should be expanded.\n Accepted values are: `items.product` (requires `project_configuration:products:read` permission).",
          "in": "query",
          "required": false,
          "type": "array"
        }
      ]
    },
    {
      "id": "list-paywalls",
      "description": "Get a list of paywalls",
      "method": "GET",
      "path": "/projects/{project_id}/paywalls",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "starting_after",
          "description": "starting_after",
          "in": "query",
          "required": false,
          "type": "string"
        },
        {
          "name": "limit",
          "description": "limit",
          "in": "query",
          "required": false,
          "type": "integer",
          "default": 20
        },
        {
          "name": "expand",
          "description": "Specifies which fields in the response should be expanded.\n Accepted values are: `items.offering` (requires `project_configuration:offerings:read` permission).",
          "in": "query",
          "required": false,
          "type": "array"
        }
      ]
    },
    {
      "id": "grant-customer-entitlement",
      "description": "Grant an entitlement to a customer unless one already exists. As a side effect, a promotional subscription is created.",
      "method": "POST",
      "path": "/projects/{project_id}/customers/{customer_id}/actions/grant_entitlement",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "entitlement_id",
          "description": "The ID of the entitlement to grant to the customer.",
          "in": "body",
          "required": true,
          "type": "string"
        },
        {
          "name": "expires_at",
          "description": "The date after which the access to the entitlement expires in ms since epoch.",
          "in": "body",
          "required": true,
          "type": "integer"
        }
      ],
      "confirm": true
    },
    {
      "id": "revoke-customer-granted-entitlement",
      "description": "Revoke a granted entitlement from a customer. As a side effect, the promotional subscription associated with the granted entitlement is expired.",
      "method": "POST",
      "path": "/projects/{project_id}/customers/{customer_id}/actions/revoke_granted_entitlement",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "entitlement_id",
          "description": "The ID of the granted entitlement to revoke from the customer.",
          "in": "body",
          "required": true,
          "type": "string"
        }
      ],
      "confirm": true
    },
    {
      "id": "assign-customer-offering",
      "description": "Assign or clear an offering override for a customer",
      "method": "POST",
      "path": "/projects/{project_id}/customers/{customer_id}/actions/assign_offering",
      "parameters": [
        {
          "name": "project_id",
          "description": "ID of the project",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "customer_id",
          "description": "ID of the customer",
          "in": "path",
          "required": true,
          "type": "string"
        },
        {
          "name": "offering_id",
          "description": "The ID of the offering to assign to the customer. Set to null to clear any existing override.",
          "in": "body",
          "required": true,
          "type": "string"
        }
      ],
      "confirm": true
    }
  ]
};
