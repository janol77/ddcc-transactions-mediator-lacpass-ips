# WHO SVC Transactions Mediator
**FROM: Openhim Production Bootstrap Mediator**

>_Este archivo README.md esta tambien disponible en inglés ([README](../README.md))._

---

## Prerrequisitos

* Docker engine: https://docs.docker.com/engine/install/ 
* Compose: https://docs.docker.com/compose/install/ 

---

## Configurando el DDCC Mediador

Este mediador es configurado usando variables de ambiente

Las siguientes variables se pueden configurar mediante el archivo docker:

| Variable de Ambiente | Default | Descripción |
| --- | --- | --- |
| FHIR_SERVER | http://fhir:8080/fhir/ | URL del repositorio de Datos |
| MATCHBOX_SERVER | http://resource-generation-service:8080/fhir/ | URL del transformador de recursos |
| MEDIATOR_HOST | ddcc | HOST utilizado en el mediador|
| OPENHIM_URL | <https://localhost:8080> | URL de OpenHIM API |
| OPENHIM_USERNAME | root@openhim.org | Usuario OpenHIM Registrado |
| OPENHIM_PASSWORD | openhim-password | Password del Usuario OpenHIM Registrado |
| TRUST_SELF_SIGNED | `false` | En Ambientes de Desarrollo OpenHIM usa certificados autofirmados por lo que es inseguro, Para permitir que el mediador se comunique con OpenHIM a travez de HTTPS esta variable puede ser cambiada a `true` para ignorar este riesgo de seguridad. **Esto se debe hacer solo en un ambiente de desarrollo**|
| PRIVATE_KEY_FILE | /app/cert-data/priv.pem | Ubicación de la llave privada|

---

## Configuring OpenHIM

Para rutear peticiones desde un clinte hasta sistemas de destino, OpenHIM necesita tener `canales` configurados para escuchar peticiones específicas y enviarlas a endpoints específicos

El mediador es configurado (dentro de [mediatorConfig.json](mediatorConfig.json)) para crear algunos canales y endpoints por defecto. Para crear estos canales navegue por la pagina de mediadores en la consola de OpenHIM.

---

## Instrucciones Equipo Desarrollo

### Crear llave Privada

* agregar en la ruta /cert-data si ya cuenta con una llave privada
* genere una llave privada dentro de la carpeta /cert-data

```bash
cd cert-data/
openssl genrsa -out priv.pem 2048
```

### Correr DDCC mediador con openhim

#### Para el uso con un repositorio externo

* create an environment variable call FHIR_SERVER an a network call ddcc_net

```bash
export FHIR_SERVER=http://fhir:8080/fhir/
docker network create -d bridge ddcc-net
docker build -t openhie/ddcc-transactions-openhim:latest -t openhie/ddcc-transactions-openhim:v1.0.20 -f Dockerfile.openhim .
docker-compose -f docker/docker-compose.openhim-external-repo.yml up -d
```
#### Para usar sin un repositorio existente

```bash
docker build -t openhie/ddcc-transactions-openhim:latest -t openhie/ddcc-transactions-openhim:v1.0.20 -f Dockerfile.openhim .
docker-compose -f docker/docker-compose.openhim.yml up -d
```

* Cambiar el password en la consola OpenHIM http://localhost:9000  usar el user:password (root@openhim.org:openhim-password)
* En el nuevo passoword ingresar **ddcc.2022**
* Ingresar nuevamente en la consola http://localhost:9000 
* Crear un cliente http://localhost:9000/#!/clients  (client ID = ddcc y client Name = ddcc)
    * Ir a pestaña authentication y crear credenciales del tipo Basic Auth usando `ddcc`
    * Guarde los cambios
* Ir a Mediators en el Sidebar y presionar en install(botón +) para que se agregue el nuevo canal
* *robar el nuevo usuario usando las credenciales (user/password --> ddcc:ddcc)
    * Ejemplo
```
GET /ddcc/shc_issuer/.well-known/jwks.json HTTP/1.1
Host: localhost:5001
Authorization: Basic ZGRjYzpkZGNj
```


### Actualización de código

* Para probar cambios

* Use el `docker_file`: **docker/docker-compose.openhim-external-repo.yml** o **docker/docker-compose.openhim.yml**

```bash
docker-compose -f `docker_file` stop ddcc
docker-compose -f `docker_file` rm ddcc -y
docker build -t openhie/ddcc-transactions-openhim:latest -t openhie/ddcc-transactions-openhim:v1.0.20 -f Dockerfile.openhim .
docker-compose -f `docker_file` up -d ddcc
docker-compose -f `docker_file` logs  --follow ddcc

```

* Inspeccionar Base de datos de hapifhir(servidor: hapi-postgres)

```
docker run -itd --network=ddcc-net -p 9001:8080 adminer
```

* Vaya a localhost:9001 y acceda a la base de datos usando credenciales.