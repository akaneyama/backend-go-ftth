import sys

with open("ftth-be/controllers/client_controller.go", "r") as f:
    content = f.read()

start = content.find("func ImportClients")
end = content.find("func GetClientImportTemplate")

with open("scratch/ImportClients.go", "r") as f:
    new_func = f.read()

new_content = content[:start] + new_func + "\n" + content[end:]

with open("ftth-be/controllers/client_controller.go", "w") as f:
    f.write(new_content)
