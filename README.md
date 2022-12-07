# WHO SVC Transactions Mediator
**FROM: Openhim Production Bootstrap Mediator**

>_This README.md file in also available in Spanish ([README-Spanish](README-translated/README-Spanish.md))._

## Prerrequisites

* Docker engine: https://docs.docker.com/engine/install/ 
* Compose: https://docs.docker.com/compose/install/ 

---

## Configuring DDCC Mediator

This mediator is configured using environment variables.

The following variables can be set:

| Environment Variable | Default | Description |
| --- | --- | --- |
| FHIR_SERVER | http://fhir:8080/fhir/ | URL of data repository |
| MATCHBOX_SERVER | http://resource-generation-service:8080/fhir/ | URL of resource transformer |
| MEDIATOR_HOST | ddcc | HOST used in mediador|
| OPENHIM_URL | <https://localhost:8080> | The location of the the OpenHIM API |
| OPENHIM_USERNAME | root@openhim.org | Registered OpenHIM Username |
| OPENHIM_PASSWORD | openhim-password | Password of the registered OpenHIM user |
| TRUST_SELF_SIGNED | `false` | In development environments the OpenHIM uses self-signed certificates therefore it is insecure. To allow the mediator to communicate with the OpenHIM via HTTPS this variable can be set to `true` to ignore the security risk. **This should only be done in a development environment** |

---

## Configuring OpenHIM

To route requests from a client to destination systems, the OpenHIM needs to have `channels` configured to listen for specific requests and send them to specific endpoints.

This mediator is configured (within [mediatorConfig.json](mediatorConfig.json)) to create some default channels and endpoints. To create these channels navigate to the mediators page on the OpenHIM Console.

---

## Instructions for the development team

### Create a private key

* add the private key to the path /cert-data if you have one.
* generate one inside de folder cert-data/

```bash
cd cert-data/
openssl genrsa -out priv.pem 2048
```

### Run DDCC mediator with OpenHIM

#### For use with an external repository

* Review installation guide [Repository install](https://cens.atlassian.net/wiki/spaces/OD/pages/2011365377/Instalaci+n+Servidor+HL7+FHIR+OPS+DDCC+Repositorio)

* create an environment variable call FHIR_SERVER with the url of the repository and a network call ddcc_net

```bash
export FHIR_SERVER=http://fhir:8080/fhir/
docker network create -d bridge ddcc-net
docker build -t openhie/ddcc-transactions-openhim:latest -t openhie/ddcc-transactions-openhim:v1.0.20 -f Dockerfile.openhim .
docker-compose -f docker/docker-compose.openhim-external-repo.yml up -d
```
#### For use without an external repository 

```bash
docker build -t openhie/ddcc-transactions-openhim:latest -t openhie/ddcc-transactions-openhim:v1.0.20 -f Dockerfile.openhim .
docker-compose -f docker/docker-compose.openhim.yml up -d
```


* Change the password in the OpenHIM console http://localhost:9000 use the user:passdord for access (root@openhim.org:openhim-password)
* Use **ddcc.2022** as a new password
* Login again into the console and use the user:password (root@openhim.org:ddcc.2022)
* Create a client in http://localhost:9000/#!/clients (client ID = ddcc y client Name = ddcc)
    * Go to authentication tab and add a basic auth password using `ddcc`
    * Save changes
* Go to Mediators page in the sidebar and install(+ button) the mediator to install the new channel
* Test the new user using the credentials (user:password --> ddcc:ddcc)
    * Example:
```
GET /ddcc/shc_issuer/.well-known/jwks.json HTTP/1.1
Host: localhost:5001
Authorization: Basic ZGRjYzpkZGNj
```

### Update the code changes

* Run this to test changes

* Use `docker_file` **docker/docker-compose.openhim-external-repo.yml** or **docker/docker-compose.openhim.yml**

```bash
docker-compose -f `docker_file` stop ddcc
docker-compose -f `docker_file` rm ddcc -y
docker build -t openhie/ddcc-transactions-openhim:latest -t openhie/ddcc-transactions-openhim:v1.0.20 -f Dockerfile.openhim .
docker-compose -f `docker_file` up -d ddcc
docker-compose -f `docker_file` logs  --follow ddcc

```

* if you want to inspect the database of hapifhir(server: hapi-postgres)

```
docker run -itd --network=ddcc-net -p 9001:8080 adminer
```
* Go to localhost:9001 and access to the database with credentials.
